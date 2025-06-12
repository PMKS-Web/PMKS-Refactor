import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';


export interface ZoomPan {
    viewBoxX: number;
    viewBoxY: number;
    viewBoxWidth: number;
    viewBoxHeight: number;
    windowWidth: number;
    windowHeight: number;
    currentZoom: number;
    zoomScale: number;
}


@Injectable({
    providedIn: 'root'
})
export class PanZoomService{

    private zoomPan: ZoomPan;

constructor() {
    this.zoomPan = {
        viewBoxX: -(window.innerWidth),
        viewBoxY: -(window.innerHeight),
        viewBoxWidth: window.innerWidth*2,
        viewBoxHeight: window.innerHeight*2,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        currentZoom: 2.00,
        zoomScale: 1.10
    }

}
  // Handles zooming in or out based on mouse scroll events and updates the viewBox accordingly.
  public _onMouseScrollWheel(event: WheelEvent){
      event.stopPropagation();

      let zoomDirection: number = event.deltaY;
      let zoomLeftFraction: number = event.offsetX / this.zoomPan.windowWidth;
      let zoomTopFraction: number = event.offsetY / this.zoomPan.windowHeight;
      let oldViewBoxWidth: number = this.zoomPan.viewBoxWidth;
      let oldViewBoxHeight: number = this.zoomPan.viewBoxHeight;

      if(zoomDirection > 0){

          this.zoomPan.currentZoom *= this.zoomPan.zoomScale;
          this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * this.zoomPan.currentZoom;
          this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * this.zoomPan.currentZoom;

          this.zoomPan.viewBoxX -=((this.zoomPan.viewBoxWidth - oldViewBoxWidth) * zoomLeftFraction);
          this.zoomPan.viewBoxY -=((this.zoomPan.viewBoxHeight - oldViewBoxHeight) * zoomTopFraction);
      }else{

          this.zoomPan.currentZoom /= this.zoomPan.zoomScale;
          this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * this.zoomPan.currentZoom;
          this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * this.zoomPan.currentZoom;

          this.zoomPan.viewBoxX += ((this.zoomPan.viewBoxWidth - oldViewBoxWidth) * -zoomLeftFraction);
          this.zoomPan.viewBoxY += ((this.zoomPan.viewBoxHeight - oldViewBoxHeight) * -zoomTopFraction);
      }
  }

  // Adjusts the viewBox position when the SVG is dragged by the specified offset.
  public _onSVGDrag(dragOffset: Coord){
      this.zoomPan.viewBoxX -= dragOffset.x * this.zoomPan.currentZoom;
      this.zoomPan.viewBoxY -= dragOffset.y * this.zoomPan.currentZoom;
  }

  public getCurrentZoom(): number {
    return this.zoomPan.currentZoom;
  }

  // Updates window and viewBox dimensions when the browser window is resized.
  public _onWindowResize(event: UIEvent){
      event.stopPropagation();
      this.zoomPan.windowWidth = window.innerWidth;
      this.zoomPan.windowHeight = window.innerHeight;
      this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * this.zoomPan.currentZoom;
      this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * this.zoomPan.currentZoom;
  }

  // Returns the current viewBox string for SVG rendering.
  public getViewBox():string{
      return this.zoomPan.viewBoxX.toString() + " "
          +  this.zoomPan.viewBoxY.toString() + " "
          +  this.zoomPan.viewBoxWidth.toString() + " "
          +  this.zoomPan.viewBoxHeight.toString() + " ";
  }

  // Provides the current ZoomPan state object.
  public getZoomPan(): ZoomPan{
      return this.zoomPan;

  }

  // Zooms in by modifying the viewBox around its center.
  public zoomIn() {
    this.zoom(1);
  }

  // Zooms out by modifying the viewBox around its center.
  public zoomOut() {
    this.zoom(-1);
  }

  // Core zoom logic that adjusts viewBox dimensions and position based on direction.
  private zoom(direction: number) {
    let zoomDirection: number = direction;
    let zoomLeftFraction: number = 0.5; // Center zoom
    let zoomTopFraction: number = 0.5; // Center zoom
    let oldViewBoxWidth: number = this.zoomPan.viewBoxWidth;
    let oldViewBoxHeight: number = this.zoomPan.viewBoxHeight;

    if (zoomDirection > 0) {
      this.zoomPan.currentZoom /= this.zoomPan.zoomScale;
    } else {
      this.zoomPan.currentZoom *= this.zoomPan.zoomScale;
    }

    this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * this.zoomPan.currentZoom;
    this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * this.zoomPan.currentZoom;

    this.zoomPan.viewBoxX -= ((this.zoomPan.viewBoxWidth - oldViewBoxWidth) * zoomLeftFraction);
    this.zoomPan.viewBoxY -= ((this.zoomPan.viewBoxHeight - oldViewBoxHeight) * zoomTopFraction);
  }

  // Resets the viewBox and zoom state to their initial default values.
  public resetView() {
    this.zoomPan = {
      viewBoxX: -(window.innerWidth),
      viewBoxY: -(window.innerHeight),
      viewBoxWidth: window.innerWidth * 2,
      viewBoxHeight: window.innerHeight * 2,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      currentZoom: 2.00,
      zoomScale: 1.10
    };
  }

  public setZoom(zoom: number): void {
    this.zoomPan.currentZoom = zoom;
    this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * zoom;
    this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * zoom;
  }

  public getViewBoxX(): number {
    return this.zoomPan.viewBoxX;
  }

  public getViewBoxY(): number {
    return this.zoomPan.viewBoxY;
  }

  public setPan(x: number, y: number): void {
    this.zoomPan.viewBoxX = x;
    this.zoomPan.viewBoxY = y;
  }



}
