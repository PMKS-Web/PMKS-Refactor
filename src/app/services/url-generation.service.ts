
import { Encoder } from './encoder';
import { Mechanism } from '../model/mechanism';

export class UrlGenerationService {

  constructor(private mechanism: Mechanism) {
    //conatins mechanism implicitly ^^^
  }

  /**
   * Main call Function, todo will generate the full URL
   */
  generateUrl(): string {
    const encoder = new Encoder();
    encoder.encodeMechanism(this.mechanism);
    return encoder.getEncodedData();
  }
}
