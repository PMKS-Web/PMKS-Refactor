import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GridToggleService {
  private gridEnabledSubject = new BehaviorSubject<boolean>(true);
  private minorGridEnabledSubject = new BehaviorSubject<boolean>(true);

  gridEnabled$ = this.gridEnabledSubject.asObservable();
  minorGridEnabled$ = this.minorGridEnabledSubject.asObservable();

  setGridEnabled(value: boolean) {
    this.gridEnabledSubject.next(value);
  }

  setMinorGridEnabled(value: boolean) {
    this.minorGridEnabledSubject.next(value);
  }
}
