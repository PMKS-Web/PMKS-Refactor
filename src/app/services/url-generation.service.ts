
import { EncoderService } from './encoder.service';
import { Mechanism } from '../model/mechanism';
//import {MechanismService} from "./mechanism.service";

export class UrlGenerationService {

  constructor(private mechanism: Mechanism) {
    //conatins mechanism implicitly ^^^
  }

  /**
   * Main call Function, todo will generate the full URL
   */
  get generateUrl(): string {
    //const encoder = new EncoderService();
    const mechURL: string = EncoderService.encodeForURL(this.mechanism);
    let currentUrl: string = window.location.href;
    if (!currentUrl.endsWith("/")) { currentUrl += "/"; }
    return currentUrl + mechURL;
  }

  /**
   * helper, deals with the asynchronous nature of writing text
   */
  private async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Text copied to clipboard');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  /**
   * full e2e
   */
  copyURL() {
    console.log('copyURL');
    let url = this.generateUrl; //todo TEST
    let promise = this.copyToClipboard(url);

    console.log('Mechanism URL copied. If you make additional changes, copy the URL again.');
  }
}
