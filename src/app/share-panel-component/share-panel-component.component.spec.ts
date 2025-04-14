import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharePanelComponentComponent } from './share-panel-component.component';

describe('SharePanelComponentComponent', () => {
  let component: SharePanelComponentComponent;
  let fixture: ComponentFixture<SharePanelComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharePanelComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharePanelComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
