export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private scriptProcessor: ScriptProcessorNode | null = null;
  private _isRecording = false;

  get isRecording(): boolean {
    return this._isRecording;
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? 44100;
  }

  async start(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });

    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 4096;

    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.recordedChunks = [];

    this.scriptProcessor.onaudioprocess = (event) => {
      if (this._isRecording) {
        const inputData = event.inputBuffer.getChannelData(0);
        this.recordedChunks.push(new Float32Array(inputData));
      }
    };

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);

    this._isRecording = true;
  }

  stop(): Float32Array {
    this._isRecording = false;

    this.scriptProcessor?.disconnect();
    this.analyserNode?.disconnect();
    this.sourceNode?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());

    const totalLength = this.recordedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    const sampleRate = this.sampleRate;
    this.audioContext?.close();
    this.audioContext = null;
    this.mediaStream = null;
    this.analyserNode = null;
    this.sourceNode = null;
    this.scriptProcessor = null;
    this.recordedChunks = [];

    void sampleRate;
    return result;
  }

  getWaveformData(): Float32Array {
    if (!this.analyserNode) return new Float32Array(0);
    const data = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(data);
    return data;
  }
}
