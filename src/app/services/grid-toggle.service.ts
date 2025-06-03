import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GridToggleService {
  private gridEnabledSubject = new BehaviorSubject<boolean>(true);
  private minorGridEnabledSubject = new BehaviorSubject<boolean>(true);

  gridEnabled$ = this.gridEnabledSubject.asObservable();
  minorGridEnabled$ = this.minorGridEnabledSubject.asObservable();

  // Enables or disables the main grid visibility.
  setGridEnabled(value: boolean) {
    this.gridEnabledSubject.next(value);
  }

  // Enables or disables the minor grid visibility.
  setMinorGridEnabled(value: boolean) {
    this.minorGridEnabledSubject.next(value);
  }
}
