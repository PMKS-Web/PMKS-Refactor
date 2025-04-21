import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavePanelComponentComponent } from './save-panel-component.component';

describe('SavePanelComponentComponent', () => {
  let component: SavePanelComponentComponent;
  let fixture: ComponentFixture<SavePanelComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavePanelComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SavePanelComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
