import { Injectable } from '@angular/core';
import { ContextMenuOption, Interactor } from '../controllers/interactor';

@Injectable({
    providedIn: 'root'
})
export class ContextMenuService {

    private visible: boolean = false;
    private position: { x: number, y: number } = { x: 0, y: 0 };
    private options: ContextMenuOption[] = [];

    constructor() { }

    /*
    Used by interaction service to show context and hide context menu based on mouse inputs
    */

    // on right click on interactor. show context menu at mouse position with interator-specified options
    public showContextMenu(interactor: Interactor, event: MouseEvent) {

        const menuOptions = interactor.specifyContextMenu();

        if (menuOptions.length === 0) {
            this.hideContextMenu();
            return;
        }

        this.visible = true;
        this.position.x = event.clientX;
        this.position.y = event.clientY;
        this.options = menuOptions;
    }

    // Hides the context menu and resets its state.
    public hideContextMenu() {
        this.visible = false;
        this.position = { x: 0, y: 0 };
        this.options = [];
    }

    /*
    Used by the context menu component for visibility and position information
    */
    public getVisibility(): boolean {
        return this.visible;
    }

    // Retrieves the current X-coordinate for the context menu position.
    public getX(): number {
        return this.position.x;
    }

    // Retrieves the current Y-coordinate for the context menu position.
    public getY(): number {
        return this.position.y;
    }

    // Provides the list of context menu options currently set.
    public getMenuOptions(): ContextMenuOption[] {
        return this.options;
    }

}
