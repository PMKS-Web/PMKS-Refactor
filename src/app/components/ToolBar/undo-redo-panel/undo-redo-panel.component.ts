import { Component } from '@angular/core';

@Component({
  selector: 'app-undo-redo-panel',
  templateUrl: './undo-redo-panel.component.html',
  styleUrls: ['./undo-redo-panel.component.scss']
})
export class UndoRedoPanelComponent {

  onUndo() {
    console.log('Undo clicked');
  }

  onRedo() {
    console.log('Redo clicked');
  }
}
