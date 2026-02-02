import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend?: Resend;
  private readonly from?: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('RESEND_KEY');
    this.from = this.config.get<string>('MAIL_FROM_ADDRESS') || 'no-reply@example.com';
    if (key) {
      this.resend = new Resend(key);
    }
  }

  async send(to: string, subject: string, html: string) {
    if (!this.resend) return;
    try {
      await this.resend.emails.send({ from: this.from!, to, subject, html });
    } catch {}
  }
}
