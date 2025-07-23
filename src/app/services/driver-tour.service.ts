import Driver from 'driver.js/dist/driver.esm.js';
import 'driver.js/dist/driver.css';
import {Injectable} from "@angular/core";

@Injectable({ providedIn: 'root' })
export class DriverTourService {
  private driver = new Driver();

  public start(steps: Step[]) {
    this.driver.defineSteps(steps);
    this.driver.start();
  }
}
