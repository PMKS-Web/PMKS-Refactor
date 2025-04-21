import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedbackPanelComponentComponent } from './feedback-panel-component.component';

describe('FeedbackPanelComponentComponent', () => {
  let component: FeedbackPanelComponentComponent;
  let fixture: ComponentFixture<FeedbackPanelComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackPanelComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeedbackPanelComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
