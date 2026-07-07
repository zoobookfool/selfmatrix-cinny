import {
  ClientEvent,
  KnownMembership,
  MatrixClient,
  MatrixEvent,
  MatrixEventEvent,
  Room,
  RoomStateEvent,
} from 'matrix-js-sdk';
import {
  ClientWidgetApi,
  IRoomEvent,
  Widget,
  WidgetApiToWidgetAction,
  WidgetDriver,
} from 'matrix-widget-api';
import { CallWidgetDriver } from '../CallWidgetDriver';
import { ElementCallThemeKind, ElementMediaStateDetail, ElementWidgetActions } from '../types';
import { CallControlState } from '../CallControlState';
import { NativeCallControl } from './NativeCallControl';
import { createNativeIframeShim } from './NativeIframeShim';
import {
  getOrClaimWidgetTransport,
  SelfmatrixNativeBridge,
  SelfmatrixNativeWidgetTransport,
} from './nativeBridge';

/**
 * `CallEmbed` (src/app/plugins/call/CallEmbed.ts) と並存するネイティブシェル向け実装
 * (design/native-widget-transport.md §2.3)。`CallEmbed` を継承しない (継承すると
 * コンストラクタが iframe の生成/container への append を前提にしてしまい、
 * `CallControl` への依存も一緒に持ち込んでしまうため)。
 *
 * 公開インターフェースは hooks (`useCallEmbed.ts`) / Provider
 * (`CallEmbedProvider.tsx`) が実際に使う範囲で `CallEmbed` と揃えてある: `call` /
 * `room` / `roomId` / `joined` / `control` / `setTheme` / `hangup` / `listenAction` /
 * `listenEvent` / `dispose`。イベントフィード系のロジック (feedEvent 相当の
 * onEvent/onEventDecrypted/onStateUpdate/onToDeviceEvent や read-up-to マーカー) は
 * iframe に依存しない `ClientWidgetApi`/`CallWidgetDriver` 側の都合であり、
 * `CallEmbed.ts` からほぼそのまま移植している (出典コメント参照)。
 *
 * 既知の未実装/差分 (実装報告に記載):
 * - `CallEmbed.document`/`CallEmbed.iframe` に相当する公開メンバーは実装しない。
 *   native では WebContentsView の実 DOM に host からアクセスできない
 *   (design §1.5) ため、意味を持たせられない。唯一の利用箇所である
 *   `useCallSpeakers.ts` は `callEmbed.document?.querySelectorAll(...)` を
 *   `undefined` として安全に no-op 化するため (`document` を明示的に
 *   `undefined` 固定で実装することでこれを保証している)、実行時エラーにはならないが
 *   話者ハイライト機能自体はネイティブでは動作しない。
 */
export class NativeCallEmbed {
  private mx: MatrixClient;

  public readonly call: ClientWidgetApi;

  public readonly room: Room;

  public joined = false;

  public readonly control: NativeCallControl;

  private readonly transport: SelfmatrixNativeWidgetTransport;

  private readUpToMap: { [roomId: string]: string } = {}; // room ID to event ID

  private eventsToFeed = new WeakSet<MatrixEvent>();

  private readonly disposables: Array<() => void> = [];

  // dispose() で mx.off に渡す参照は on() で渡した関数と同一である必要がある
  // (EventEmitter は参照一致で listener を照合する)。呼び出しのたびに
  // `.bind(this)` すると毎回新しい関数になり off() が効かなくなるため、
  // 束縛済み関数をフィールドとして 1 度だけ生成して使い回す。
  private readonly onEventBound = this.onEvent.bind(this);

  private readonly onEventDecryptedBound = this.onEventDecrypted.bind(this);

  private readonly onStateUpdateBound = this.onStateUpdate.bind(this);

  private readonly onToDeviceEventBound = this.onToDeviceEvent.bind(this);

  /**
   * native では WebContentsView の実 DOM に host からアクセスできないため常に
   * undefined。唯一の呼び出し元 `useCallSpeakers.ts` はこれを optional chaining
   * (`callEmbed.document?.querySelectorAll(...)`) で読むため、安全に no-op 化される
   * (話者ハイライト機能自体は動作しない。クラス doc コメント参照)。
   */
  // eslint-disable-next-line class-methods-use-this
  public get document(): Document | undefined {
    return undefined;
  }

  constructor(
    mx: MatrixClient,
    room: Room,
    widget: Widget,
    bridge: SelfmatrixNativeBridge,
    initialControlState?: CallControlState
  ) {
    // G2 (受け入れレビュー修正): claim-once はシェル側のプロセス寿命 1 回きりの制約 (同一オリジン
    // iframe 対策、nativeBridge.ts の getOrClaimWidgetTransport() コメント参照) なので、2 通話目
    // 以降もここで直接 bridge.claimWidgetTransport() を呼ぶと必ず throw する。キャッシュ付き
    // ヘルパー経由にすることで、通話ごとに新しい NativeCallEmbed が構築されても安全に成立する。
    const transport = getOrClaimWidgetTransport(bridge);
    const iframeShim = createNativeIframeShim(transport);

    const callWidgetDriver: WidgetDriver = new CallWidgetDriver(mx, room.roomId);
    // SelfMatrix M1 step 3a レビュー FIX-D (順序不変条件、nativeBridge.ts の
    // openCallView() 契約コメントと相互参照): `new ClientWidgetApi(...)` は同期的に
    // PostmessageTransport.start() を実行し 'message' リスナー登録を完了させる。
    // これが下の `transport.openCallView(completeUrl)` (EC ロード開始の依頼) より
    // 必ず先に実行されることで、design §1.1 の順序不変条件 (EC ロード開始前に
    // リスナー登録済みであること) を満たしている。ClientWidgetApi 構築を非同期化
    // する場合や openCallView の呼び出し経路を増やす場合は、prototype の
    // native:widget-host-ready 相当の合図が別途必要になる。
    const call: ClientWidgetApi = new ClientWidgetApi(widget, iframeShim, callWidgetDriver);

    this.mx = mx;
    this.call = call;
    this.room = room;
    this.transport = transport;

    const controlState = initialControlState ?? new CallControlState(true, false, true);
    this.control = new NativeCallControl(controlState, call, transport);

    let initialMediaEvent = true;
    this.disposables.push(
      this.listenAction<ElementMediaStateDetail>(ElementWidgetActions.DeviceMute, (evt) => {
        if (initialMediaEvent) {
          initialMediaEvent = false;
          this.control.applyState();
          return;
        }
        this.control.onMediaState(evt);
      })
    );

    // 既存 CallEmbed と同じく widget.getCompleteUrl() で完成 URL を作り、
    // シェルに WebContentsView のロードを依頼する (design §2.3)。
    const completeUrl = widget.getCompleteUrl({ currentUserId: mx.getSafeUserId() });
    transport.openCallView(completeUrl).catch((e) => {
      console.error('Error opening native call view: ', e);
    });

    this.start();
  }

  get roomId(): string {
    return this.room.roomId;
  }

  public setTheme(theme: ElementCallThemeKind) {
    return this.call.transport.send(WidgetApiToWidgetAction.ThemeChange, {
      name: theme,
    });
  }

  public hangup() {
    return this.call.transport.send(ElementWidgetActions.HangupCall, {});
  }

  public onPreparing(callback: () => void) {
    return this.listenEvent('preparing', callback);
  }

  public onPreparingError(callback: (error: any) => void) {
    return this.listenEvent('error:preparing', callback);
  }

  public onReady(callback: () => void) {
    return this.listenEvent('ready', callback);
  }

  public onCapabilitiesNotified(callback: () => void) {
    return this.listenEvent('capabilitiesNotified', callback);
  }

  // 出典: CallEmbed.ts の start()。iframe に依存しないルームイベントフィード配線
  // なので無改造で成立する。
  private start() {
    // Room widgets get locked to the room they were added in
    this.call.setViewedRoomId(this.roomId);
    this.disposables.push(
      this.listenAction(ElementWidgetActions.JoinCall, this.onCallJoined.bind(this))
    );

    this.mx.getRooms().forEach((room) => {
      const events = room.getLiveTimeline()?.getEvents() || [];
      const roomEvent = events[events.length - 1];
      if (!roomEvent) return;
      this.readUpToMap[room.roomId] = roomEvent.getId()!;
    });

    this.mx.on(ClientEvent.Event, this.onEventBound);
    this.mx.on(MatrixEventEvent.Decrypted, this.onEventDecryptedBound);
    this.mx.on(RoomStateEvent.Events, this.onStateUpdateBound);
    this.mx.on(ClientEvent.ToDeviceEvent, this.onToDeviceEventBound);
  }

  /**
   * 既存 CallEmbed.dispose() との差分: iframe の removeChild は無く、代わりに
   * シェルへ closeCallView() を依頼する (design §2.3)。
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => {
      disposable();
    });
    this.call.stop();
    this.control.dispose();
    this.transport.closeCallView().catch((e) => {
      console.error('Error closing native call view: ', e);
    });

    this.mx.off(ClientEvent.Event, this.onEventBound);
    this.mx.off(MatrixEventEvent.Decrypted, this.onEventDecryptedBound);
    this.mx.off(RoomStateEvent.Events, this.onStateUpdateBound);
    this.mx.off(ClientEvent.ToDeviceEvent, this.onToDeviceEventBound);

    this.readUpToMap = {};
    this.eventsToFeed = new WeakSet<MatrixEvent>();
  }

  private onCallJoined(): void {
    this.joined = true;
  }

  private onEvent(ev: MatrixEvent): void {
    this.mx.decryptEventIfNeeded(ev);
    this.feedEvent(ev);
  }

  private onEventDecrypted(ev: MatrixEvent): void {
    this.feedEvent(ev);
  }

  private onStateUpdate(ev: MatrixEvent): void {
    if (this.call === null) return;
    const raw = ev.getEffectiveEvent();
    this.call.feedStateUpdate(raw as IRoomEvent).catch((e) => {
      console.error('Error sending state update to widget: ', e);
    });
  }

  private async onToDeviceEvent(ev: MatrixEvent): Promise<void> {
    await this.mx.decryptEventIfNeeded(ev);
    if (ev.isDecryptionFailure()) return;
    await this.call?.feedToDevice(ev.getEffectiveEvent() as IRoomEvent, ev.isEncrypted());
  }

  private relatesToUnknown(ev: MatrixEvent): boolean {
    if (!ev.relationEventId || ev.replyEventId) return false;
    const room = this.mx.getRoom(ev.getRoomId());
    return room === null || !room.findEventById(ev.relationEventId);
  }

  private advanceReadUpToMarker(ev: MatrixEvent): boolean {
    const evId = ev.getId();
    if (evId === undefined) return false;
    const roomId = ev.getRoomId();
    if (roomId === undefined) return false;
    const room = this.mx.getRoom(roomId);
    if (room === null) return false;

    const upToEventId = this.readUpToMap[ev.getRoomId()!];
    if (!upToEventId) {
      this.readUpToMap[roomId] = evId;
      return true;
    }

    if (upToEventId === evId) return false;

    const timeline = room.getLiveTimeline();
    const events = [...timeline.getEvents()].reverse().slice(0, 100);
    function isRelevantTimelineEvent(timelineEvent: MatrixEvent): boolean {
      return timelineEvent.getId() === upToEventId || timelineEvent.getId() === ev.getId();
    }
    const possibleMarkerEv = events.find(isRelevantTimelineEvent);
    if (possibleMarkerEv?.getId() === upToEventId) {
      return false;
    }
    if (possibleMarkerEv?.getId() === ev.getId()) {
      this.readUpToMap[roomId] = evId;
      return true;
    }

    return false;
  }

  private isFromInvite(ev: MatrixEvent): boolean {
    const room = this.mx.getRoom(ev.getRoomId());
    return room?.getMyMembership() === KnownMembership.Invite;
  }

  private feedEvent(ev: MatrixEvent): void {
    if (this.call === null) return;
    if (
      this.eventsToFeed.delete(ev) ||
      this.relatesToUnknown(ev) ||
      this.isFromInvite(ev) ||
      this.advanceReadUpToMarker(ev)
    ) {
      if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) {
        this.eventsToFeed.add(ev);
      } else {
        const raw = ev.getEffectiveEvent();
        this.call.feedEvent(raw as IRoomEvent).catch((e) => {
          console.error('Error sending event to widget: ', e);
        });
      }
    }
  }

  public listenAction<T>(type: string, callback: (event: CustomEvent<T>) => void) {
    return this.listenEvent(`action:${type}`, callback);
  }

  public listenEvent<T>(type: string, callback: (event: T) => void) {
    this.call.on(type, callback);
    return () => {
      this.call.off(type, callback);
    };
  }
}
