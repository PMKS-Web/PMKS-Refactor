
import { EncoderService } from './encoder.service';
import { StateService } from './state.service';
import {DecoderService} from "./decoder.service";

export class UrlGenerationService {

  constructor(private stateService: StateService) {

      //conatins mechanism implicitly ^^^
    }


  /**
   * Will dynamically generate and return a string URL
   * based on the mechanism from current state service data
   *   -- uses current URL for copying, ie "http://localhost:4200"
   * @returns string
   */
  get generateUrl(): string {
    const encoder = new EncoderService(this.stateService);
    const encodedMechanism: string = encoder.encodeForURL();
    let currentUrl: string = window.location.href;
    if (!currentUrl.endsWith("/")) { currentUrl = currentUrl.substring(currentUrl.length - 1); }
    return currentUrl + "?data=" + encodedMechanism;
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
