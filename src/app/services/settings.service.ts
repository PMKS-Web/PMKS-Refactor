import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GlobalUnit } from '../model/utils';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  globalUnit = new BehaviorSubject(GlobalUnit.METRIC);
  isInputCW = new BehaviorSubject(true);
  isForces = new BehaviorSubject(false);
  inputSpeed = new BehaviorSubject(20);
  constructor() {}
}
