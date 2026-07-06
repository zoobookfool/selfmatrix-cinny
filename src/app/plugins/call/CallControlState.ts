export class CallControlState {
  public readonly microphone: boolean;

  public readonly video: boolean;

  public readonly sound: boolean;

  public readonly screenshare: boolean;

  public readonly spotlight: boolean;

  // SelfMatrix: 強調選択 (グリッドモード時のみ意味を持つ)。UI 合意 v1.4 ①②。
  public readonly emphasis: boolean;

  constructor(
    microphone: boolean,
    video: boolean,
    sound: boolean,
    screenshare = false,
    spotlight = false,
    emphasis = false
  ) {
    this.microphone = microphone;
    this.video = video;
    this.sound = sound;
    this.screenshare = screenshare;
    this.spotlight = spotlight;
    this.emphasis = emphasis;
  }
}
