import { Component,AfterViewInit } from '@angular/core';
import { DriverTourService } from './services/driver-tour.service';


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
    setTimeout(() => {
      this.tour.start();
    }, 0);
  }


}
