import {Injectable} from '@angular/core';
import { Interactor } from '../controllers/interactor';
import { Coord } from '../model/coord';
import { ContextMenuService } from './context-menu.service';
import { ClickCapture, ClickCaptureID } from '../controllers/click-capture/click-capture';
import { Subject } from 'rxjs';
import { SvgInteractor } from '../controllers/svg-interactor';
import { MousePosition } from './mouse-position.service';
import { PanZoomService, ZoomPan } from './pan-zoom.service';
import { UnitConversionService } from './unit-conversion.service';
import { BehaviorSubject } from 'rxjs';

/*
This service keeps track of global state for the interaction system, such as which
objects are selected, and whether they are being dragged. It takes in raw mouse events
from the view and converts them to selection and drag events, which are then sent to
Interactors.
*/

@Injectable({
    providedIn: 'root'
})
export class InteractionService {

    private mousePos: MousePosition;
    private objects: Interactor[] = [];
    private selected = new Set<Interactor>(); // set of currently-selected objects
    public isDragging: boolean = false; // whether the selected objects are being dragged
    private lastSelected: Interactor | undefined = undefined;
    private _selectionChange: BehaviorSubject<Interactor | undefined> = new BehaviorSubject<Interactor | undefined>(this.lastSelected);
    public _selectionChange$ = this._selectionChange.asObservable();
    private heldKeys: Set<string> = new Set<string>(); // keys currently being held down

    private mouseMovedAfterDown: boolean = false; // whether the mouse has moved since the last mouse down event

    public hoveringObject?: Interactor; // object that the mouse is currently hovering over

    // a SINGULAR notification that a drag has ended. Use when you don't want to receive
    // multiple notifications when multiple objects are finished dragging. useful i.e. for saving / doing computations
    public onDragEndOnce$ = new Subject<boolean>();

    private clickCapture: ClickCapture | undefined;
    constructor(private contextMenuService: ContextMenuService,
              private panZoomService: PanZoomService,
                private unitConverter: UnitConversionService) {

        this.mousePos = {
            screen: new Coord(0,0),
            svg: new Coord(0,0),
            model: new Coord(0,0)
        };


    }


    // select the object and deselect all others
    private selectNewObject(object: Interactor, deselectOldObjects: boolean = true): void {


        let isAlreadySelected = this.selected.has(object);
        this.lastSelected = object;
        this._selectionChange.next(this.lastSelected);

        // deselect all other objects and call onDeselect().
        // if the object is already selected, do not call onDeselect() on it.
        this.selected.forEach((oldObj) => {
            if (oldObj !== object && (deselectOldObjects || oldObj instanceof SvgInteractor )) {
                oldObj.isSelected = false;
                this.selected.delete(oldObj);
                oldObj._onDeselect();
            }
        });

        if (isAlreadySelected) return;
        this.selected.add(object);
        if (object.selectable) object._onSelect();
    }

    // select the object and unselect all others
    public _onMouseDown(object: Interactor, event: MouseEvent): void {
        this.mouseMovedAfterDown = false;

        event.stopPropagation(); // don't let parent components handle this event

        // if click capture, handle special case
        if (this.clickCapture) {
            this.clickCapture.onClick$.next(this.mousePos.model);
            this.exitClickCapture();
            return;
        }

        if (event.button !== 0) return; // only handle left click. should not be called on right click/context menu

        // hide any context menus
        this.contextMenuService.hideContextMenu();

        // don't deselect old objects if shift is held down (ie. multi-select)
        let alreadySelected = this.selected.has(object);
        this.selectNewObject(object, (!this.isPressingKey("Shift") && !alreadySelected) || object instanceof SvgInteractor);

        this.isDragging = true;

        // if the object is draggable, then start dragging it
        this.selected.forEach((obj) => {
            if (obj.draggable) obj._onDragStart();
        });

    }

    // Handles right‐mouse‐button press to select an Interactor and show its context menu.
    public _onMouseRightClick(object: Interactor, event: MouseEvent): void {
        this.mouseMovedAfterDown = false;

        event.preventDefault(); // prevent context menu from appearing
        event.stopPropagation(); // don't let parent components handle this event
        // if click capture, handle special case
        if (this.clickCapture) {
            this.clickCapture.onClick$.next(this.mousePos.model);
            this.exitClickCapture();
            return;
        }

        this.selectNewObject(object);
        this.isDragging = false;

        // show context menu
        this.contextMenuService.showContextMenu(object, event);

        object._onRightClick();

    }

    // Handles mouse‐button release to end dragging or deselect objects as needed.
    public _onMouseUp(object: Interactor, event: MouseEvent): void {
        event.stopPropagation(); // don't let parent components handle this event

        // if it was a click, deselect objects that were not clicked on
        // if shift is held down, don't do this (ie. multi-select)
        if (!this.mouseMovedAfterDown && !this.isPressingKey("Shift")) {
            // deselect all objects that are not object

            let objectsToRemove = new Set<Interactor>();
            this.selected.forEach((obj) => {
                if (obj !== object) {
                    obj._onDeselect();
                    objectsToRemove.add(obj);
                }
            });
            objectsToRemove.forEach((obj) => this.selected.delete(obj));

        }

        let somethingDragged = false;
        this.selected.forEach((obj) => {
            if (obj.draggable) {
                somethingDragged = true;
                obj._onDragEnd();
            }
        });

        // something was changed after drag
        if (this.isDragging && this.mouseMovedAfterDown && somethingDragged) {
            this.onDragEndOnce$.next(true);
        }

        this.isDragging = false;

    }
    // if mouse is down, then drag the selected objects
    public _onMouseMove(object: Interactor, event: MouseEvent): void {
        //update the mouse position within the SVG
        let screenX = parseFloat(event.pageX.toFixed(3));
        let screenY = parseFloat(event.pageY.toFixed(3));
        let screenPos: Coord = new Coord(screenX, screenY);
        let currentZoomPan: ZoomPan = this.panZoomService.getZoomPan();
        this.mousePos = {
            screen : screenPos,
            svg : this.unitConverter.mouseCoordToSVGCoord(screenPos, currentZoomPan),
            model : this.unitConverter.mouseCoordToModelCoord(screenPos, currentZoomPan),
        }

        this.mouseMovedAfterDown = true;
        if(!this.isDragging){
            this.hoveringObject = object;
        }

        event.stopPropagation(); // don't let parent components handle this event

        if (this.clickCapture) {
            this.clickCapture.onMouseMove$.next(this.mousePos.model);
            return;
        }

        if (this.isDragging) {
            this.selected.forEach((obj) => {
                if (obj.draggable) obj._onDrag();
            });
        }
    }
    // Records key press events, updates held keys, and notifies selected Interactors.
    public onKeyDown(event: KeyboardEvent): void {

        // add key to heldKeys
        if (!this.heldKeys.has(event.key)) {
            this.heldKeys.add(event.key);
        }

        // if click capture, consume all keyboard events
        if (this.clickCapture) {

            // esc while click capture is active will cancel the click capture
            if (event.key === "Escape") this.exitClickCapture();

            return // do not propagate keyboard events to other interactors
        }

        // call onKeyDown on all selected objects
        this.selected.forEach((obj) => {
            obj._onKeyDown(event);
        });

    }

    // Records key release events and removes keys from the held keys set.
    public onKeyUp(event: KeyboardEvent): void {
        // remove key from heldKeys
        if (this.heldKeys.has(event.key)) {
            this.heldKeys.delete(event.key);
        }
    }

    // Returns whether the specified key is currently being held down.
    public isPressingKey(key: string): boolean {
        return this.heldKeys.has(key);
    }

    // registers an interactor to receive mouse events
    public register(interactor: Interactor): void {
        interactor.initInteraction(this.getMousePos.bind(this));
        this.objects.push(interactor);
    }

    // make sure to unregister when the object is destroyed
    public unregister(interactor: Interactor): void {
        this.objects = this.objects.filter((obj) => obj !== interactor);
    }

    // Enters “click capture” mode, forwarding the next click event to a ClickCapture object.
    public enterClickCapture(clickCapture: ClickCapture): void {
        this.clickCapture = clickCapture;
    }

    // Retrieves the current ClickCapture instance, if any.
    public getClickCapture(): ClickCapture | undefined {
        return this.clickCapture;
    }

    // Retrieves the ID of the current ClickCapture, if any.
    public getClickCaptureID(): ClickCaptureID | undefined {
        return this.clickCapture?.id;
    }

    // Exits “click capture” mode, cancelling any pending capture.
    public exitClickCapture(): void {
        this.clickCapture = undefined;
    }

    // Returns the Interactor that the mouse is currently hovering over, if any.
    public getHoveringObject(): Interactor | undefined {
        return this.hoveringObject;
    }

    // Returns the current mouse position in screen, SVG, and model coordinates.
    public getMousePos(): MousePosition {
        return this.mousePos;
    }

    // Returns the last selected Interactor, if any.
    public getSelectedObject(): Interactor | undefined {
        return this.lastSelected;
    }

    // Deselects any currently selected Interactor.
    public deselectObject(){
        this.lastSelected=undefined;
    }

    // Selects the specified Interactor and deselects all others.
    public setSelectedObject(interactor: Interactor): void {
      this.selectNewObject(interactor);
    }

}
