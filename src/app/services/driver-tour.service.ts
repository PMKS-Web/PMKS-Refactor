import {Injectable} from "@angular/core";
import { TOUR_STEPS, TourStep } from '../components/Tours/driver-tour';
import { driver } from 'driver.js';

@Injectable({ providedIn: 'root' })
export class DriverTourService {
  private driverInstance = driver({
    opacity:    0.7,
    padding:    8,
    showButtons: true,
    nextBtnText: 'Next ➔',
    prevBtnText: '⟵ Back',
    doneBtnText: 'Got it!'
  });


  public start(steps: TourStep[] = TOUR_STEPS): void {
    this.driverInstance.setSteps(steps as any[]);
    this.driverInstance.drive();
  }
}
