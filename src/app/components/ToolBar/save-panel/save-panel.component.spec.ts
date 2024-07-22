import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavePanelComponent } from './save-panel.component';

describe('SavePanelComponent', () => {
  let component: SavePanelComponent;
  let fixture: ComponentFixture<SavePanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavePanelComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SavePanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
