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
  collectNativeCallLocalStorageSnapshot,
  getOrClaimWidgetTransport,
  SelfmatrixNativeBridge,
  SelfmatrixNativeWidgetTransport,
} from './nativeBridge';

/**
 * SelfMatrix M3 step 4: call view の attach 先。`nativeBridge.ts` の
 * `onCallViewPlacement()` が push する値と同じ語彙 (design/m3-window-ux.md §2 サブステップ 4)。
 * cinny 側 (hooks/useCallEmbed.ts、CallControls.tsx) の型注釈用に再エクスポートする。
 */
export type CallViewPlacement = 'main' | 'window' | 'none';

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
 *
 * SelfMatrix M3 step 4 (design/m3-window-ux.md §2 サブステップ 4): `popout()`/`popin()`/
 * `getCallViewPlacement()`/`onCallViewPlacementChange()` を追加。web 版の `CallPopout` (別クラス、
 * 「離脱 → 別窓で再 join」の再接続方式) とは異なり、native は再親子付け方式 (無再接続、
 * design §0) のため通話中ずっと同じ `NativeCallEmbed` インスタンスのまま — `callEmbedAtom`
 * を差し替えない (state/callEmbed.ts の atom setter は差し替え時に旧 embed を dispose() する
 * ため、web の popout のように新インスタンスへ差し替えると通話が切れてしまう)。
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

  // 外部ミュート制御 選択肢 A (design/external-mute-control.md §4.1、運用者確定要件 2026-07-12):
  // onEventBound と同じ理由で束縛済み関数をフィールドとして 1 度だけ生成する — ただしこちらは
  // EventEmitter の off() 照合のためではなく、77d0196d の教訓 (CallEmbed でのリスナーリーク) を
  // 踏まえ「登録した参照と同一の参照を確実に保持し、dispose で解除できるようにする」ため。
  private readonly onExternalMuteToggleBound = this.onExternalMuteToggle.bind(this);

  private readonly onStateUpdateBound = this.onStateUpdate.bind(this);

  private readonly onToDeviceEventBound = this.onToDeviceEvent.bind(this);

  /**
   * M2 bounds sync (Fable 全体レビュー arch-major 解消): 直近シェルへ送った bounds。
   * `undefined` = まだ 1 度も送っていない (setPlacement() 側の同値スキップが「一度も送って
   * いないのに null が来て skip してしまう」誤判定をしないための区別。null (送信済みで
   * 「隠す」状態) と undefined (未送信) を分けている)。
   */
  private lastSentBounds: { x: number; y: number; width: number; height: number } | null | undefined;

  /** setPlacement() の requestAnimationFrame まとめ用ハンドル。 */
  private pendingBoundsFrame: number | undefined;

  /**
   * M3 step 4: call view が現在どの窓に attach されているか。既存の `setPlacement()`/
   * `lastSentBounds` (M2 bounds sync、cinny 内レイアウト矩形の push) とは全くの別概念
   * (nativeBridge.ts の `onCallViewPlacement()` 契約コメント参照) なので、命名の紛れを避けて
   * `callViewPlacement` と名付けている。openCallView() は常に mainWindow へ描画を依頼する
   * (design §2.3) ため初期値は "main"。以降は `onCallViewPlacementChange()` の購読者経由でのみ
   * 更新される — 別窓をユーザーが X で閉じたときの "main" への自動復帰 (design §3-5) も
   * この経路で反映される。
   */
  private callViewPlacement: CallViewPlacement = 'main';

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

    // 外部ミュート制御 選択肢 A (design/external-mute-control.md §4.1、運用者確定要件 2026-07-12):
    // シェルのグローバルホットキー/トレイのアクション項目から届く「ミュートをトグルせよ」という
    // 合図を購読する。this.control が既に構築済みの、この行より後に置く必要がある。dispose() は
    // this.disposables を全て呼ぶため、他の listenAction() 由来の unsubscribe と同じ配列に積むだけで
    // 解除される (77d0196d の教訓どおり、リスナーリークさせない)。
    this.disposables.push(transport.onExternalMuteToggle(this.onExternalMuteToggleBound));

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
    // M1 step 3c-2 (localStorage 契約の実機対応): call view は別 session partition のため
    // localStorage が共有されない (nativeBridge.ts の openCallView()/
    // collectNativeCallLocalStorageSnapshot() コメント参照)。EC 起動前にシェルが書き込めるよう、
    // 現在の matrix-setting-* スナップショットを一緒に渡す。
    const completeUrl = widget.getCompleteUrl({ currentUserId: mx.getSafeUserId() });
    const localStorageSnapshot = collectNativeCallLocalStorageSnapshot();
    transport.openCallView(completeUrl, localStorageSnapshot).catch((e) => {
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

  /**
   * M2 bounds sync (Fable 全体レビュー arch-major 解消): `useCallEmbedPlacementSync`
   * (hooks/useCallEmbed.ts) が計算した「実際に call view を表示すべき領域」を transport 経由で
   * シェルへ push する。web 版の `CallEmbed` はこの矩形を `CallEmbedProvider` の
   * `position:fixed` div へ直接スタイル適用するだけで完結するが (`useCallEmbedPlacementSync` の
   * 4 行、変更していない)、native では実描画がシェル側の別プロセス (WebContentsView) にあるため
   * この push が要る (`nativeBridge.ts` の `setCallViewBounds()` 契約参照)。
   *
   * `rect` が `null` の場合は「隠す/レイアウト外」を意味する (呼び出し元:
   * `useCallEmbedPlacementSync` のアンマウント時クリーンアップ、および本クラスの `dispose()`)。
   *
   * **過剰送信の抑制はここ (cinny 側、送信元) に置く**:
   *   - 同値スキップ: `useCallEmbedPlacementSync` は `ResizeObserver` 発火のたびに毎回呼ぶ
   *     (呼び出し側を単純に保つため、変化の有無をそちら側では判定させない)。ここで直前送信値と
   *     比較し、実質的に変化が無ければ IPC 送信自体を省く。
   *   - `requestAnimationFrame` まとめ: 同一フレーム内で複数回呼ばれても実際にシェルへ送るのは
   *     最後の 1 回だけにする。`ResizeObserver` のコールバック頻度はブラウザ実装依存で「1 フレーム
   *     1 回」が仕様として保証されているわけではないため、ここで明示的に保証する。
   * シェル側 (`main.cjs` の `applyCallViewBoundsFromCinny()`) にも実際の View の現在値と比較して
   * 同値なら `setBounds()` 自体を呼ばない防御を二重に持たせてある (`View.setBounds()` は同じ値でも
   * 呼べば内部で再レイアウトが走り得るため、送信元側の抑制をすり抜けた場合の保険— 詳細は
   * native-prototype の `main.cjs` 該当コメント参照)。
   */
  public setPlacement(rect: DOMRectReadOnly | null): void {
    const bounds = rect
      ? {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      : null;

    const unchanged =
      this.lastSentBounds !== undefined &&
      ((bounds === null && this.lastSentBounds === null) ||
        (bounds !== null &&
          this.lastSentBounds !== null &&
          bounds.x === this.lastSentBounds.x &&
          bounds.y === this.lastSentBounds.y &&
          bounds.width === this.lastSentBounds.width &&
          bounds.height === this.lastSentBounds.height));
    if (unchanged) return;

    this.lastSentBounds = bounds;

    if (this.pendingBoundsFrame !== undefined) {
      cancelAnimationFrame(this.pendingBoundsFrame);
    }
    this.pendingBoundsFrame = requestAnimationFrame(() => {
      this.pendingBoundsFrame = undefined;
      this.transport.setCallViewBounds(bounds);
    });
  }

  /**
   * SelfMatrix M3 step 4 (design/m3-window-ux.md §2 サブステップ 4): ⧉ ボタン (native 分岐、
   * CallControls.tsx) から呼ばれる。call view を別窓へ無再接続で出す
   * (`nativeBridge.ts` の `popoutCallView()` 契約参照)。web 版の `useCallPopout` (離脱して
   * 別窓で再 join) とは異なりこのインスタンス自体は差し替わらない — 呼び出し元は
   * `callEmbedAtom` を一切操作しないこと (差し替えると旧 embed として dispose() されてしまう)。
   */
  public popout(): Promise<void> {
    return this.transport.popoutCallView();
  }

  /**
   * SelfMatrix M3 step 4: popout() の逆。「メインに戻す」導線 (CallControls.tsx の native 分岐、
   * ⧉ ボタンが 'window' 状態のときのクリック) から呼ばれる (`nativeBridge.ts` の
   * `popinCallView()` 契約参照)。既に "main" ならシェル側で no-op になる (popinCallView() の
   * JSDoc 参照) ため、呼び出し元は現在の placement を確認せず無条件に呼んでよい。
   */
  public popin(): Promise<void> {
    return this.transport.popinCallView();
  }

  /** 現在の call view の attach 先 (直近の push 済み値、または初期値 "main")。 */
  public getCallViewPlacement(): CallViewPlacement {
    return this.callViewPlacement;
  }

  /**
   * SelfMatrix M3 step 4 (design §3-5「placement 状態の逆方向 push」): `nativeBridge.ts` の
   * `onCallViewPlacement()` を購読するラッパー。**登録直後に現在値を同期的に 1 回 replay**
   * してから以降の変化を流す — 呼び出し元 (`useNativeCallViewPlacement` フック、
   * hooks/useCallEmbed.ts) が購読開始時点の状態を取りこぼさずに初期値を得られるようにするため
   * (「別窓を X で閉じて main へ自動復帰」は cinny 側の操作を伴わず起こるため、
   * CallControls が後から (再) マウントされた場合でも実状態に同期できる必要がある)。
   *
   * 呼び出しごとに `transport.onCallViewPlacement()` へ個別に subscribe する
   * (`NativeCallControl.onCallControlState` と異なり、このクラス自身はコンストラクタで
   * 一括購読しない — CallControls は通話が joined の間ずっとマウントされたままなので
   * 単一の購読で十分足りる。複数箇所が同時に購読しても push チャンネル自体は
   * `onCallControlState` と同じ多重購読対応の契約)。戻り値は unsubscribe 関数。
   */
  public onCallViewPlacementChange(listener: (placement: CallViewPlacement) => void): () => void {
    listener(this.callViewPlacement);
    return this.transport.onCallViewPlacement((placement) => {
      this.callViewPlacement = placement;
      listener(placement);
    });
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
    // M2 bounds sync: closeCallView() でシェルが view 自体を破棄するはずだが、
    // useCallEmbedPlacementSync 側のアンマウント時クリーンアップ (roomId 不一致等) と経路が
    // 独立しているため、通話終了 (hangup/エラー) 経由の破棄でも防御的に null を送っておく
    // (setPlacement() の同値スキップにより、既に null 送信済みなら実質 no-op)。
    this.setPlacement(null);
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

  /**
   * 外部ミュート制御 選択肢 A (design/external-mute-control.md §4.1): シェルから届いた
   * "ミュートをトグルせよ" の合図に反応する。`toggleMicrophone()` は widget action
   * (`ElementWidgetActions.DeviceMute`) 経由で完結する既存メソッドで、無改造のまま呼ぶだけでよい
   * (design 冒頭「結論サマリ」参照 — 外部制御が新設すべきなのは引き金の設計だけで、ミュート自体の
   * ロジックは既に web/native 両方に存在する)。
   */
  private onExternalMuteToggle(): void {
    this.control.toggleMicrophone();
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
