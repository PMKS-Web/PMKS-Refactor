import { Component, OnDestroy, OnInit } from '@angular/core';
import { Interactor } from 'src/app/controllers/interactor';
import { InteractionService } from 'src/app/services/interaction.service';
import { AnimationService } from 'src/app/services/animation.service';

/*
All interactive components should extend this class. This class binds the component
to an interactor, and handles its construction and destruction. Subclasses will need
to implement registerInteractor() so that this class can bind the interactor.

*/

@Component({
  selector: 'app-abstract-interactive',
  templateUrl: './abstract-interactive.component.html',
  styleUrls: ['./abstract-interactive.component.css']
})
export abstract class AbstractInteractiveComponent implements OnInit, OnDestroy{
  private interactor!: Interactor;

  constructor(
    protected interactionService: InteractionService,
    protected animationService: AnimationService
  ) { }

  abstract registerInteractor(): Interactor;

  ngOnInit(): void {
    this.interactor = this.registerInteractor();
    this.interactionService.register(this.interactor);
  }

  public getInteractor(): Interactor {
    return this.interactor;
  }

  ngOnDestroy(): void {
    this.interactionService.unregister(this.interactor);
  }

  isSelected(): boolean {
    return this.interactor.isSelected;
  }

  isHovered(): boolean {

    if (this.animationService.isAnimating){
      return false;
    }



    return ( this.interactor === this.interactionService.getHoveringObject())
  }

}
