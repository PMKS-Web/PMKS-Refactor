
import { Encoder } from './encoder';
import { Mechanism } from '../model/mechanism';

export class UrlGenerationService {

  constructor(private mechanism: Mechanism) {
    //conatins mechanism implicitly ^^^
  }

  /**
   *
   */
  generateUrl(): string {
    const encoder = new Encoder();
    encoder.encodeMechanism(this.mechanism);
    return encoder.getEncodedData();
  }
}
