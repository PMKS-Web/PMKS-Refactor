import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { SvgInteractor } from 'src/app/controllers/svg-interactor';
import { ContextMenuOption, Interactor } from 'src/app/controllers/interactor';
import { InteractionService } from 'src/app/services/interaction.service';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { StateService } from 'src/app/services/state.service';
import { PanZoomService } from 'src/app/services/pan-zoom.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';

@Component({
  selector: 'app-svg',
  templateUrl: './svg.component.html',
  styleUrls: ['./svg.component.css']
})
export class SvgComponent extends AbstractInteractiveComponent {

  constructor(public override interactionService: InteractionService,
    private stateService: StateService, private panZoomService: PanZoomService, private unitConversionService: UnitConversionService) {

    super(interactionService);
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
  }

  // handle keyboard events and send to interaction service
  @HostListener('window:resize', ['$event'])
  onWindowResize(event: UIEvent) {
      this.panZoomService._onWindowResize(event);
  }
  override registerInteractor(): Interactor {
    let interactor = new SvgInteractor(this.stateService,this.interactionService, this.panZoomService);

    interactor.onKeyDown$.subscribe((event) => {
      if (event.key === "s") {
      }
    });

    return interactor;
  }

  getViewBox(): string{
    return this.panZoomService.getViewBox();
  }



}
