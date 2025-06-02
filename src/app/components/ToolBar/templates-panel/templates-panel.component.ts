import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { Mechanism } from 'src/app/model/mechanism';
import { Coord } from 'src/app/model/coord';
import { Joint } from 'src/app/model/joint';
import { Link } from 'src/app/model/link';
import { StateService } from 'src/app/services/state.service';
import { ToolbarComponent } from 'src/app/components/ToolBar/toolbar/toolbar.component';
import {PositionSolverService} from "../../../services/kinematic-solver.service";


@Component({
  selector: 'app-templates-panel',
  templateUrl: './templates-panel.component.html',
  styleUrls: ['./templates-panel.component.scss'],

})
export class TemplatesPanelComponent {

  private mechanism: Mechanism;
  public open = true;
  // Get current URL without query params
  private currentUrl = window.location.href.split('?')[0]; 

  constructor(private interactionService: InteractionService, private stateService: StateService, public toolbarComponent: ToolbarComponent, private positionSolver: PositionSolverService){
    //creates a new mechanism in the state
    this.mechanism = this.stateService.getMechanism();
  }
  togglePanel(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (!target.closest('.app-templates-panel-container')) {
      this.open = false;
      this.toolbarComponent.setCurrentTab('');

    }
  }

  openTemplate(linkage: string){
    this.open=false; //closes panel sort of, will need a better fix to actually close the panel in the toolbar
    //Opens a new windows using the encoded data from the url encoder
    let newWindow = null;;
    switch (linkage) {
      case 'fourbar':
        newWindow = window.open(`${this.currentUrl}?data=N4IgViBcDa0gDAPwIIgPoFoDMA6AjFpgEw7x5oh6JICeidAhogHYtvMYZUBC6GJANiJp4OAJwUqSVqyYz2nIogDC6XGTQl4ADknV2iOQY7ZEAETU4sAFkx4cAgKx7abI-OYgAul4oAbKFgEFG59AGIAdiIIgDEzRz4SbQjnDFFHR2sxbJzcnIp4AB8qFnQSMUy0bVF4RzFfOB5lcKIYrABRMRj0UTwxLLzB7Vt7LMlCpVK0RxwU4QRFFTNw+DM8IkdUNFw8FJEcIjxHeBPTs9PdECJCrEQp3AjrZwRvXxAAYygQRAAXL8QAGb-AAOXxAAF8gA`, '_blank');
        break;
      case 'watt':
        newWindow = window.open(`${this.currentUrl}?data=N4IgViBcDa0gDAPwIIgPoFoCMA6A7FprgMzFohaJICeitAhogHbOtMbaIBC6GATDgCsANjTwcwvuUpIWLRnLYc+iAMK9c8MsSGiKVNogWH2GYogAi6AQBY0JPTMPHFpm4gCi6PELv8JUvo0rC5KGIKIAGLeOFgAnGiCsQAc0gaKoXIcwogA4ui4cQnJsWRBzibMIAC61eQANlCwCChcBgDEeHx4kRaCvAJYxIKY4sOC8JNT01N2CAA+lFVog932Q0KCfHVwlFyqFh18kcQecdGjOMRxwrd39-d49jjJNg-vt08U83zz5ss6YhYObwZSWDyRDrwCxYPiCVCJfCEEjwD4fcjEeY2eYRZbCITwQgIDjmSK5I7wLpxPDoGxCBL44SCEYgQTzHLLJLUhLEjDuXKqKGouKCKxiHA2VJJV4TGYzInCH6ITkSvCpBA1OogADGUBAiAALnrEAAzY0ABz1IAAvkA`);
        break;
      case 'watt2':
        newWindow =  window.open(`${this.currentUrl}?data=N4IgViBcDa0gDAPwIKILQGZ0CZEEZEkBPRAO0QEMzrzS00CAhdDEAfTXgDoBWNkAklqUaNergDC7TrzZ5ZAwqKrDa9LABF2PWfOz9By0WrQAWRAFF2GBWlyGSJFcfo9EAMUQAjdnoNLhZ1V6ADZEAHFfPT47Lgx-YmogmhAAXVT+ABsoWAQUZiQAYgB2bGL3DTdMaWj+eAAfAjJfBR4KeiYJJULsdwwLAE53Gq5ivm4+AXrcZrYbbHh9BHFECQ0LbvgNPGweZHZsLgAODFOz8-PxrmwL27PTfmx6jHrzWZCueHhiuvVEDU8RQWpQGxXYR2ufD8IBeblmOkm8Ho5nc4U28BCAx4Wjk8h2MQmpgGxJJpNJ-B49TCsxsPHgAzqaQyIAAxlAQIgAC7sxAAMx5AAd2SAAL5AA`);
        break;
      case 'steph3':
        newWindow =  window.open(`${this.currentUrl}?data=N4IgViBcDa0gDAPwIIgPoFoBMA6LncAWAdjRAEZEkBPRWgQ0QDtnWmMNKAhdbHQgGyZ4OAJwAOMpSQsWjWWw5ZEAYUQBmdCPLqpVNonkH2GdYgAi6dXiGcx+CvtpzjzDoUQBRXiPwjRejKsRgomAKyIAGJaOOKk1uSSjkEuoW4YAogA4uhhOGFo5DjwhIF0wa5MIAC61WQANlCwCChc+gDExFjEkeZhvLjqunZdBQgAPpTM6EVhOmiiorESdXDcKp4dWJHqnqLRaNo6Qyenp6Ui8OQCN7d3d0nk41jjHtNoeWFdZPBKquYdeDmchYMKoNAJYYicSiMYvMzvXDwG4-DhmTyRLbwLqiYgxIaERZE4nEoRI0ogQjjCKI-LkAIIdxRLKA5GwywQnCJAq4cjkeACwVCwW6EBhcaZd55fnkH41OogADGUBAiAALirEAAzTUABxVIAAvkA`);
        break;
      case 'slider':
         newWindow = window.open(`${this.currentUrl}?data=N4IgViBcDa0gDAPwIKILQGZFIIzcQJ6GICGiAdhVeWmngEIgD6aATAHQCsTH3IeSSpTJDqtVogDCiLAPxFh1aiAC6KpiAA2UWAhT18AYgDsrYwDEAIp2Zt2x7jnas+8AD54KzXt2MAOdgA2AE51OAZpJENWcwwAUWDzZnhnR3s+HDcJLyZOe3gcDXhVdRAAYygQRAAXSsQAMzqAB0qQAF8gA`);
        break;
    }
    if (newWindow) {
      newWindow.sessionStorage.setItem('isNewTab', 'true');
    }
  }
}
