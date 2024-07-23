import { Component} from '@angular/core'



@Component({
    selector: 'app-toolbar',
    templateUrl: './toolbar.component.html',
    styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent {


selectedPanel: string = '';

setCurrentTab(clickedPanel: string){
    console.log(clickedPanel);
    if(clickedPanel==this.selectedPanel) {
      this.selectedPanel = '';
    }else{
        this.selectedPanel= clickedPanel;}

    console.log("Current Selected: " + this.selectedPanel);
}

getSelected(): string {
    return this.selectedPanel;
}

}
