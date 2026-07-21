import { FastifyReply } from 'fastify';

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
}

export class SSEStream {
  private reply: FastifyReply;
  private closed = false;

  constructor(reply: FastifyReply) {
    this.reply = reply;
    this.setup();
  }

  private setup() {
    this.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.reply.raw.on('close', () => {
      this.closed = true;
    });
  }

  send(event: SSEEvent) {
    if (this.closed) return;

    let message = '';
    if (event.event) {
      message += `event: ${event.event}\n`;
    }
    if (event.id) {
      message += `id: ${event.id}\n`;
    }
    message += `data: ${event.data}\n\n`;

    this.reply.raw.write(message);
  }

  sendEvent(eventName: string, data: any) {
    this.send({
      event: eventName,
      data: JSON.stringify(data),
    });
  }

  sendText(text: string) {
    this.send({
      event: 'text',
      data: text,
    });
  }

  sendCard(type: string, data: any) {
    this.send({
      event: 'card',
      data: JSON.stringify({ type, data }),
    });
  }

  sendDone() {
    this.send({
      event: 'done',
      data: '[DONE]',
    });
  }

  sendError(message: string) {
    this.send({
      event: 'error',
      data: JSON.stringify({ message }),
    });
  }

  close() {
    if (!this.closed) {
      this.closed = true;
      this.reply.raw.end();
    }
  }

  isClosed() {
    return this.closed;
  }
}
