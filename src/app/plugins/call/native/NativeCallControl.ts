import EventEmitter from 'events';
import { ClientWidgetApi } from 'matrix-widget-api';
import { CallControlState } from '../CallControlState';
import { ElementMediaStateDetail, ElementMediaStatePayload, ElementWidgetActions } from '../types';
import { CallControlEvent } from '../CallControl';
import { SelfmatrixNativeWidgetTransport } from './nativeBridge';

/**
 * カテゴリ B (design §2.2: screenshare/spotlight/emphasis/reactions/settings — widget
 * action が存在せず call view 内の実 DOM 操作でしか実現できない操作) の RPC action 名。
 * call view 側 preload (シェル側、step 3b で新設) がこの文字列で分岐する契約。
 *
 * SelfMatrix M1 step 3a で判明した設計との相違点 (実装報告に記載):
 * design §2.2 のカテゴリ B 列挙 (screenshare/spotlight/grid/emphasis/reactions/settings)
 * には「サウンド (スピーカー出力のミュート = deafen 相当)」が含まれていない。しかし
 * `CallControl.ts` の `setSound()` は widget action ではなく iframe の
 * `contentDocument.querySelectorAll('audio')` に対する `el.muted` 直接操作であり、
 * WebContentsView では host から到達不能な DOM 操作という点で screenshare 等と
 * 同じ性質を持つ。そのためここでは sound 系もカテゴリ B 相当として RPC 化する。
 * `callControlInvoke(action: string)` はペイロード引数を持たない契約のため、
 * 「特定の真偽値へ強制する」操作 (applySound) は toggle ではなく action 名自体に
 * 目的の状態を焼き込む (SoundOn/SoundOff) 形にしている。
 *
 * SelfMatrix M1 step 3a レビュー FIX-E (既知差分): 現行 native-prototype
 * (selfmatrix-workspace/native-prototype の call-control-preload.cjs) は
 * `toggleTarget` という単一 action のみを受理する実装であり、下記 7 action
 * (`NativeCallControlAction` の全メンバー) は prototype 側に 1 つも実装されて
 * いない。つまり本 enum は「cinny 側がシェルに要求する契約」の宣言であり、
 * 現状ではどの action も呼び出し先で解釈されない (callControlInvoke は
 * shell 側で未対応の action に対しては reject/no-op になる想定)。step 3b で
 * call view preload 側の語彙をこの enum に合わせて実装する。
 */
export enum NativeCallControlAction {
  ToggleScreenshare = 'toggleScreenshare',
  ToggleSpotlight = 'toggleSpotlight',
  ToggleEmphasis = 'toggleEmphasis',
  ToggleReactions = 'toggleReactions',
  ToggleSettings = 'toggleSettings',
  SoundOn = 'setSoundOn',
  SoundOff = 'setSoundOff',
}

function soundAction(sound: boolean): NativeCallControlAction {
  return sound ? NativeCallControlAction.SoundOn : NativeCallControlAction.SoundOff;
}

/**
 * `CallControl` (src/app/plugins/call/CallControl.ts) と同一の public インターフェースを
 * 持つネイティブシェル向け実装 (design §2.2)。継承ではなく並存 (design §2.3) のため、
 * カテゴリ A (widget action ベース、iframe/DOM に依存しない) のメソッドは元実装から
 * そのままコピーしている (出典コメントを個別に付与)。
 *
 * カテゴリ B のメソッドは `transport.callControlInvoke(action)` の RPC に置き換えている。
 * call view 側 preload からの実際の DOM 状態変化 push (元実装の MutationObserver 相当) は
 * まだ配線されていない (step 3b でシェル側の call-control preload と合わせて実装する)。
 * そのため、ここでの状態更新は「RPC が成功したら要求どおりの状態になったとみなす」楽観的な
 * 反映であり、TODO として明記してある。
 */
export class NativeCallControl extends EventEmitter implements CallControlState {
  private state: CallControlState;

  private call: ClientWidgetApi;

  private transport: SelfmatrixNativeWidgetTransport;

  private mediaStatePromiseResolver: undefined | (() => void);

  constructor(
    state: CallControlState,
    call: ClientWidgetApi,
    transport: SelfmatrixNativeWidgetTransport
  ) {
    super();

    this.state = state;
    this.call = call;
    this.transport = transport;
  }

  public getState(): CallControlState {
    return this.state;
  }

  public get microphone(): boolean {
    return this.state.microphone;
  }

  public get video(): boolean {
    return this.state.video;
  }

  public get sound(): boolean {
    return this.state.sound;
  }

  public get screenshare(): boolean {
    return this.state.screenshare;
  }

  public get spotlight(): boolean {
    return this.state.spotlight;
  }

  public get emphasis(): boolean {
    return this.state.emphasis;
  }

  public async applyState(): Promise<void> {
    // カテゴリ A (出典: CallControl.ts の applyState()。transport.send ベースのため
    // native でも無改造で成立する)。
    await this.setMediaState({
      audio_enabled: this.microphone,
      video_enabled: this.video,
    });
    // sound の再適用はカテゴリ B 相当 (このファイル冒頭コメント参照)。
    await this.invokeCallControl(soundAction(this.sound)).catch((e) => {
      console.error('Error applying native call control sound state: ', e);
    });
    this.emitStateUpdate();
  }

  // 出典: CallControl.ts の setMediaState()。call.transport.send による widget action
  // (カテゴリ A) のため iframe/DOM に依存せず、native でも無改造で成立する。
  private async setMediaState(state: ElementMediaStatePayload) {
    const data = await this.call.transport.send(ElementWidgetActions.DeviceMute, state);
    return new Promise<typeof data>((resolve) => {
      if (this.mediaStatePromiseResolver) {
        this.mediaStatePromiseResolver();
      }
      this.mediaStatePromiseResolver = () => resolve(data);
    });
  }

  // 出典: CallControl.ts の onMediaState()。CallEmbed/NativeCallEmbed が
  // ElementWidgetActions.DeviceMute の action イベントを受けて呼ぶ (カテゴリ A の応答経路)。
  public onMediaState(evt: CustomEvent<ElementMediaStateDetail>): void {
    const { data } = evt.detail;
    if (!data) return;

    const state = new CallControlState(
      data.audio_enabled ?? this.microphone,
      data.video_enabled ?? this.video,
      this.sound,
      this.screenshare,
      this.spotlight,
      this.emphasis
    );

    this.state = state;
    this.emitStateUpdate();

    if (this.microphone && !this.sound) {
      this.toggleSound();
    }

    if (this.mediaStatePromiseResolver) {
      this.mediaStatePromiseResolver();
      this.mediaStatePromiseResolver = undefined;
    }
  }

  // 出典: CallControl.ts の toggleMicrophone()。カテゴリ A、無改造で成立。
  public toggleMicrophone() {
    const payload: ElementMediaStatePayload = {
      audio_enabled: !this.microphone,
      video_enabled: this.video,
    };
    return this.setMediaState(payload);
  }

  // 出典: CallControl.ts の toggleVideo()。カテゴリ A、無改造で成立。
  public toggleVideo() {
    const payload: ElementMediaStatePayload = {
      audio_enabled: this.microphone,
      video_enabled: !this.video,
    };
    return this.setMediaState(payload);
  }

  private invokeCallControl(action: NativeCallControlAction): Promise<unknown> {
    return this.transport.callControlInvoke(action);
  }

  /**
   * TODO(M1 step 3b): RPC 成功を「要求どおりの状態になった」とみなす楽観的反映。
   * call view 側 preload からの実際の状態 push (元 CallControl.ts の
   * MutationObserver 相当) が配線され次第、その到達をもって StateUpdate を
   * 発火する対称構造に置き換える (design §2.2)。
   */
  private fireAndForgetInvoke(action: NativeCallControlAction, onSuccess: () => void): void {
    this.invokeCallControl(action)
      .then(() => {
        onSuccess();
      })
      .catch((e) => {
        console.error(`Error invoking native call control action "${action}": `, e);
      });
  }

  // カテゴリ B: 元実装 (CallControl.ts) は screenshareButton?.click() で DOM 直接操作。
  public toggleScreenshare(): void {
    const screenshare = !this.screenshare;
    this.fireAndForgetInvoke(NativeCallControlAction.ToggleScreenshare, () => {
      this.state = new CallControlState(
        this.microphone,
        this.video,
        this.sound,
        screenshare,
        this.spotlight,
        this.emphasis
      );
      this.emitStateUpdate();
    });
  }

  // カテゴリ B: 元実装は spotlight/grid いずれかの input を click。スポットライトへ
  // 切り替わると emphasis の DOM 要素自体が消える (元実装 onControlMutation と同じ扱い)。
  public toggleSpotlight(): void {
    const spotlight = !this.spotlight;
    const emphasis = spotlight ? false : this.emphasis;
    this.fireAndForgetInvoke(NativeCallControlAction.ToggleSpotlight, () => {
      this.state = new CallControlState(
        this.microphone,
        this.video,
        this.sound,
        this.screenshare,
        spotlight,
        emphasis
      );
      this.emitStateUpdate();
    });
  }

  // カテゴリ B: スポットライトモードでは emphasis の DOM 要素自体が存在しないため
  // 元実装 (CallControl.ts toggleEmphasis) と同様 no-op にする。
  public toggleEmphasis(): void {
    if (this.spotlight) return;
    const emphasis = !this.emphasis;
    this.fireAndForgetInvoke(NativeCallControlAction.ToggleEmphasis, () => {
      this.state = new CallControlState(
        this.microphone,
        this.video,
        this.sound,
        this.screenshare,
        this.spotlight,
        emphasis
      );
      this.emitStateUpdate();
    });
  }

  // カテゴリ B: 元実装は reactionsButton?.click() のみで CallControlState には
  // 対応するフィールドが無い (元実装も emitStateUpdate() を呼ばない)。
  public toggleReactions(): void {
    this.invokeCallControl(NativeCallControlAction.ToggleReactions).catch((e) => {
      console.error('Error invoking native call control action "toggleReactions": ', e);
    });
  }

  // カテゴリ B: 元実装は settingsButton?.click() のみで CallControlState には
  // 対応するフィールドが無い (元実装も emitStateUpdate() を呼ばない)。
  public toggleSettings(): void {
    this.invokeCallControl(NativeCallControlAction.ToggleSettings).catch((e) => {
      console.error('Error invoking native call control action "toggleSettings": ', e);
    });
  }

  /**
   * カテゴリ B 相当 (このファイル冒頭コメント参照)。元実装 (CallControl.ts
   * toggleSound()) と同じ副作用: サウンドを切る (deafen) 際、マイクが on なら
   * マイクも一緒にミュートする。マイクのミュート自体はカテゴリ A
   * (toggleMicrophone、transport ベース) なので RPC 不要でそのまま呼べる。
   */
  public toggleSound(): void {
    const sound = !this.sound;
    this.fireAndForgetInvoke(soundAction(sound), () => {
      this.state = new CallControlState(
        this.microphone,
        this.video,
        sound,
        this.screenshare,
        this.spotlight,
        this.emphasis
      );
      this.emitStateUpdate();

      if (!sound && this.microphone) {
        this.toggleMicrophone();
      }
    });
  }

  // 出典: CallControl.ts の applySound()。呼び出し元 (useCallMemberSoundSync 等) が
  // 通話メンバー変化のたびに現在の sound 値を再適用するためのもの (toggle ではない)。
  public applySound(): void {
    this.invokeCallControl(soundAction(this.sound)).catch((e) => {
      console.error('Error applying native call control sound state: ', e);
    });
  }

  // 元実装の bodyMutationObserver/controlMutationObserver は iframe DOM 監視の
  // ためのものであり native には存在しないため、ここでは特に破棄するものがない。
  // 将来 call view からの state push 購読を追加した場合はここで解除する。
  public dispose(): void {
    this.removeAllListeners();
  }

  private emitStateUpdate() {
    this.emit(CallControlEvent.StateUpdate);
  }
}
