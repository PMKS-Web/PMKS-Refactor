import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ColorService {

  constructor() {}

  private linkColorOptions = [
    '#727FD5',
    '#2F3E9F',
    '#0D125A',
    '#207297',
    '#00695D',
    '#0D453E',
  ];

  // Returns a color from the predefined list based on the given ID.
  getLinkColorFromID(id: number) {
    return this.linkColorOptions[id % this.linkColorOptions.length];
  }

  // Calculates the index in the color options array corresponding to the given ID.
  getLinkColorIndex(id: number){
    return id%this.linkColorOptions.length;
  }

  //Provides the full array of available link color options.
  getLinkColorOptions(){
    return this.linkColorOptions;
  }
}
