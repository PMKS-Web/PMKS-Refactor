import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
} from '@angular/core';
import { Link } from 'src/app/model/link';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/controllers/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { ColorService } from 'src/app/services/color.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import { Subscription } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';
import { ForceInteractor } from 'src/app/controllers/force-interactor';
import { Force } from 'src/app/model/force';
import { PanZoomService } from 'src/app/services/pan-zoom.service';
import { AnimationService } from 'src/app/services/animation.service';

@Component({
  selector: '[app-force]',
  templateUrl: './force.component.html',
  styleUrls: ['./force.component.scss'],
})
export class ForceComponent
  extends AbstractInteractiveComponent
  implements AfterViewInit
{
  @Input() force!: Force;
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  showIDLabelsSubscription: Subscription = new Subscription();
  animationProgressSubscription: Subscription = new Subscription();
  showIDLabels: boolean = false;
  units: string = 'N'; // Force units
  unitsAngle: string = 'º';
  angle: string = '0';

  constructor(
    public override interactionService: InteractionService,
    private stateService: StateService,
    private notificationService: NotificationService,
    private unitConversionService: UnitConversionService,
    private cdr: ChangeDetectorRef,
    private panZoomService: PanZoomService,
    private animationService: AnimationService
  ) {
    super(interactionService,animationService);
  }

  override registerInteractor(): Interactor {
    return new ForceInteractor(
      this.force,
      this.stateService,
      this.interactionService,
      this.notificationService
    );
  }

  override ngOnInit() {
    this.angleSubscription = this.stateService.globalASuffixCurrent.subscribe(
      (angles) => {
        this.unitsAngle = angles;
      }
    );
    this.showIDLabelsSubscription = this.stateService.showIDLabels$.subscribe(
      (show) => {
        this.showIDLabels = show;
      }
    );
    this.animationProgressSubscription =
      this.animationService.animationProgress$.subscribe((progress: number) => {
        console.log(progress);
      });
    super.ngOnInit();
  }

  override ngOnDestroy() {
    this.unitSubscription.unsubscribe();
    this.angleSubscription.unsubscribe();
    this.showIDLabelsSubscription.unsubscribe();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.cdr.detectChanges();
    });
  }

  getColor(): string {
    return this.force.color || '#FF0000'; // Default red color for forces
  }

  // Get the start position of the force in SVG coordinates
  getStartX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.force.start).x;
  }

  getStartY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.force.start).y;
  }

  // Get the end position of the force in SVG coordinates
  getEndX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.force.end).x;
  }

  getEndY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.force.end).y;
  }

  // Get the midpoint of the force vector
  getMidPointX(): number {
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.start
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.end
    );
    return (startCoord.x + endCoord.x) / 2;
  }

  getMidPointY(): number {
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.start
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.end
    );
    return (startCoord.y + endCoord.y) / 2;
  }

  getLineSVG(): string {
    const dx: number = this.getEndX() - this.getStartX();
    const dy = this.getEndY() - this.getStartY();
    const length = Math.sqrt(dx * dx + dy * dy);

    const shortenBy = 24;
    const ratio = (length - shortenBy) / length;

    const newEndX = this.getStartX() + dx * ratio;
    const newEndY = this.getStartY() + dy * ratio;

    return `M${this.getStartX()},${this.getStartY()} L${newEndX},${newEndY}`;
  }
  getSelectionLineSVG(): string {
    return `M${this.getStartX()},${this.getStartY()} L${this.getEndX()},${this.getEndY()}`;
  }

  // Get the arrowhead path for the force vector
  getArrowheadSVG(): string {
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.start
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.end
    );

    // Calculate the vector direction
    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return '';

    // Normalize the vector
    const unitX = dx / length;
    const unitY = dy / length;

    // Arrowhead size
    const arrowLength = 40;
    const arrowWidth = 20;

    // Calculate arrowhead points
    const arrowX1 = endCoord.x - arrowLength * unitX - arrowWidth * unitY;
    const arrowY1 = endCoord.y - arrowLength * unitY + arrowWidth * unitX;
    const arrowX2 = endCoord.x - arrowLength * unitX + arrowWidth * unitY;
    const arrowY2 = endCoord.y - arrowLength * unitY - arrowWidth * unitX;

    return `M${endCoord.x},${endCoord.y} L${arrowX1},${arrowY1} L${arrowX2},${arrowY2} Z`;
  }

  // Get the position for the force magnitude label
  getMagnitudeLabelX(): number {
    const midX = this.getMidPointX();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.start
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.end
    );

    // Calculate perpendicular offset for label positioning
    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return midX;

    // Offset perpendicular to the force vector
    const offsetDistance = 20;
    const perpX = (-dy / length) * offsetDistance;

    return midX + perpX;
  }

  getMagnitudeLabelY(): number {
    const midY = this.getMidPointY();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.start
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.end
    );

    // Calculate perpendicular offset for label positioning
    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return midY;

    // Offset perpendicular to the force vector
    const offsetDistance = 20;
    const perpY = (dx / length) * offsetDistance;

    return midY + perpY;
  }

  // Get the stroke color based on selection/hover state
  getStrokeColor(): string {
    if (this.getInteractor().isSelected) {
      return this.force.color; // Selected color
    } else if (this.isHovered()) {
      return '#FFECB3'; // Hover color
    }
    return this.getColor();
  }
  getMagnitude(): string {
    return this.force.magnitude.toFixed(3).toString() + ' ' + this.units;
  }
  getAngle(): string {
    return this.force.angle.toFixed(3).toString() + this.unitsAngle;
  }
  getName(): string {
    return (
      this.force.name +
      '\nMagnitude: ' +
      this.force.magnitude +
      ' ' +
      this.units +
      '\nAngle: ' +
      this.force.angle +
      this.unitsAngle
    );
  }
  getFrameOfReference(): string {
    return this.force.frameOfReference === 0 ? 'Local' : 'Global';
  }
  getParentLinkName(): string {
    return this.force.parentLink.name;
  }
  getVectorLength(): number {
    const dx = this.force.end.x - this.force.start.x;
    const dy = this.force.end.y - this.force.start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  getLineEndCoord(): Coord {
    const dx: number = this.getEndX() - this.getStartX();
    const dy = this.getEndY() - this.getStartY();
    const length = Math.sqrt(dx * dx + dy * dy);

    const shortenBy = 0;
    const ratio = (length - shortenBy) / length;

    const x = this.getStartX() + dx * ratio;
    const y = this.getStartY() + dy * ratio;

    return new Coord(x, y);
  }
  getScaledForceVector(): string {
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.start
    );
    const scaleFactor = 20; // pixels per unit of force
    const vectorLength = this.force.magnitude * scaleFactor;

    const angleRad = (this.force.angle * Math.PI) / 180;
    const endX = startCoord.x + vectorLength * Math.cos(angleRad);
    const endY = startCoord.y - vectorLength * Math.sin(angleRad); // Negative because SVG Y increases downward

    return `M${startCoord.x},${startCoord.y} L${endX},${endY}`;
  }

  getScaledArrowheadSVG(): string {
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      this.force.start
    );

    // Calculate scaled end point
    const scaleFactor = 20;
    const vectorLength = this.force.magnitude * scaleFactor;
    const angleRad = (this.force.angle * Math.PI) / 180;
    const endX = startCoord.x + vectorLength * Math.cos(angleRad);
    const endY = startCoord.y - vectorLength * Math.sin(angleRad);

    // Calculate arrowhead
    const arrowLength = 15;
    const arrowWidth = 8;
    const unitX = Math.cos(angleRad);
    const unitY = -Math.sin(angleRad);

    const arrowX1 = endX - arrowLength * unitX - arrowWidth * unitY;
    const arrowY1 = endY - arrowLength * unitY + arrowWidth * unitX;
    const arrowX2 = endX - arrowLength * unitX + arrowWidth * unitY;
    const arrowY2 = endY - arrowLength * unitY - arrowWidth * unitX;

    return `M${endX},${endY} L${arrowX1},${arrowY1} L${arrowX2},${arrowY2} Z`;
  }
  private isDragging = false;
  private dragType: 'start' | 'end' | null = null;
  private readonly MODEL_TO_SVG_SCALE = 200.0;

  onStartHandleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const forceInteractor = this.getInteractor() as ForceInteractor;
    forceInteractor.startHandleDragging('start');

    this.interactionService.setSelectedObject(forceInteractor);
  }

  onEndHandleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const forceInteractor = this.getInteractor() as ForceInteractor;
    forceInteractor.startHandleDragging('end');
    this.interactionService.setSelectedObject(forceInteractor);
  }
  private startDragging(type: 'start' | 'end', event: MouseEvent): void {
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.dragType) return;

    const svgElement = document.querySelector('svg'); // Adjust selector as needed
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const currentZoomPan = this.panZoomService.getZoomPan(); // or however you access it

    const svgX = currentZoomPan.viewBoxX + mouseX * currentZoomPan.currentZoom;
    const svgY = currentZoomPan.viewBoxY + mouseY * currentZoomPan.currentZoom;

    const modelX = svgX / this.MODEL_TO_SVG_SCALE;
    const modelY = -svgY / this.MODEL_TO_SVG_SCALE;

    const modelCoord = new Coord(modelX, modelY);

    if (this.dragType === 'start') {
      this.force.start = modelCoord;
    } else if (this.dragType === 'end') {
      this.force.end = modelCoord;
    }
    this.updateForceProperties();
    this.cdr.detectChanges();
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragType = null;
    }
  }

  private updateForceProperties(): void {
    // Recalculate magnitude and angle based on new start/end positions
    const dx = this.force.end.x - this.force.start.x;
    const dy = this.force.end.y - this.force.start.y;

    this.force.magnitude = Math.sqrt(dx * dx + dy * dy);
    this.force.angle = Math.atan2(dy, dx) * (180 / Math.PI);
  }
}
