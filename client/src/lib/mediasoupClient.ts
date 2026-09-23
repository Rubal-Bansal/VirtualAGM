import { Device } from 'mediasoup-client';
import type {
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
  DtlsParameters,
  MediaKind,
  RtpParameters,
} from 'mediasoup-client/types';
import type { Socket } from 'socket.io-client';
import { emitWithAck } from './socket';

interface TransportOptionsFromServer {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: DtlsParameters;
}

/**
 * Thin wrapper around mediasoup-client that hides the signaling
 * round-trips behind a small produce/consume API.
 */
export class MediaClient {
  private device = new Device();
  private sendTransport?: Transport;
  private recvTransport?: Transport;

  constructor(private socket: Socket) {}

  async load(routerRtpCapabilities: RtpCapabilities): Promise<void> {
    await this.device.load({ routerRtpCapabilities });
  }

  canConsume(): boolean {
    return this.device.loaded;
  }

  get rtpCapabilities(): RtpCapabilities {
    return this.device.rtpCapabilities;
  }

  private async ensureSendTransport(): Promise<Transport> {
    if (this.sendTransport) return this.sendTransport;
    const options = await emitWithAck<undefined, TransportOptionsFromServer>(
      this.socket,
      'createTransport',
    );
    const transport = this.device.createSendTransport(options as never);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitWithAck(this.socket, 'connectTransport', { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch(errback);
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      emitWithAck<
        { transportId: string; kind: MediaKind; rtpParameters: RtpParameters; appData?: Record<string, unknown> },
        { id: string }
      >(this.socket, 'produce', { transportId: transport.id, kind, rtpParameters, appData })
        .then(({ id }) => callback({ id }))
        .catch(errback);
    });

    this.sendTransport = transport;
    return transport;
  }

  private async ensureRecvTransport(): Promise<Transport> {
    if (this.recvTransport) return this.recvTransport;
    const options = await emitWithAck<undefined, TransportOptionsFromServer>(
      this.socket,
      'createTransport',
    );
    const transport = this.device.createRecvTransport(options as never);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitWithAck(this.socket, 'connectTransport', { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch(errback);
    });

    this.recvTransport = transport;
    return transport;
  }

  async produce(track: MediaStreamTrack, appData?: Record<string, unknown>): Promise<Producer> {
    const transport = await this.ensureSendTransport();
    return transport.produce({ track, appData });
  }

  closeProducer(producer: Producer): void {
    producer.close();
    emitWithAck(this.socket, 'closeProducer', { producerId: producer.id }).catch(console.error);
  }

  async consume(producerId: string): Promise<Consumer> {
    const transport = await this.ensureRecvTransport();
    const { id, kind, rtpParameters } = await emitWithAck<
      { transportId: string; producerId: string; rtpCapabilities: RtpCapabilities },
      { id: string; kind: MediaKind; rtpParameters: RtpParameters }
    >(this.socket, 'consume', {
      transportId: transport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
    const consumer = await transport.consume({ id, producerId, kind, rtpParameters });
    await emitWithAck(this.socket, 'resumeConsumer', { consumerId: consumer.id });
    return consumer;
  }

  closeSendTransport(): void {
    this.sendTransport?.close();
    this.sendTransport = undefined;
  }
}

export async function getLocalMediaStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
}

export async function getScreenShareStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({ video: true });
}
