import { Component } from '@angular/core';
import { DriverTourService } from './services/driver-tour.service';
import { DRIVER_TOUR } from './components/Tours/driver-tour';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'PMKS+';

  constructor(private tour: DriverTourService){

  }

  ngAfterViewInit() {
    setTimeout(() => this.tour.start(DRIVER_TOUR), 0);
  }


}
