

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule} from '@angular/material/button';
import { MatIconModule} from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import {MatButtonToggleModule} from '@angular/material/button-toggle';


/* Component Imports */
import { InteractionDirective } from 'src/app/controllers/directives/interaction-directive';
import { AppComponent } from './app.component';
import { AbstractInteractiveComponent } from './components/Grid/abstract-interactive/abstract-interactive.component';
import { ContextMenuComponent } from './components/Grid/context-menu/context-menu.component';
import { SvgComponent } from './components/Grid/svg/svg.component';
import { CreateNewCompLineComponent } from './components/Grid/create-new-comp-line/create-new-comp-line.component';
import { GraphComponent } from './components/Grid/graph/graph.component';
import { JointComponent } from './components/Grid/joint/joint.component';
import { jointEditPanelComponent} from "./components/SideNav/Edit/joint-edit-panel/joint-edit-panel.component";
import { LinkComponent } from './components/Grid/link/link.component';
import { CompoundLinkComponent } from './components/Grid/compound-link/compound-link.component';
import { GridLinesComponent } from './components/Grid/gridlines/gridlines.component';
import { ToolbarComponent } from './components/ToolBar/toolbar/toolbar.component';
import { SidenavComponent } from './components/SideNav/sidenav/sidenav.component';
import { EditPanelComponent } from './components/SideNav/Edit/edit-panel/edit-panel.component';
import { LinkEditPanelComponent } from './components/SideNav/Edit/link-edit-panel/link-edit-panel.component';
import { PanelSectionCollapsibleComponent } from './components/Blocks/panel-section-collapsible/panel-section-collapsible.component';
import { PanelSectionComponent } from './components/Blocks/panel-section/panel-section.component';
import { TitleBlock } from './components/Blocks/title/title.component';
import { CollapsibleSubsectionComponent } from './components/Blocks/collapsible-subsection/collapsible-subsection.component';
import {DualInputComponent} from "./components/Blocks/dual-input/dual-input.component";
import {FormGroup, FormsModule} from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import {ToggleComponent} from "./components/Blocks/toggle/toggle.component";
import {MatInputModule} from "@angular/material/input";
import {TriButtonComponent} from "./components/Blocks/tri-button/tri-button.component";
import { DualButtonComponent } from './components/Blocks/dual-button/dual-button.component';
import {JointAnalysisPanelComponent} from "./components/SideNav/Analysis/joint-analysis-panel/joint-analysis-panel.component";
import { AnalysisPanelComponent } from "./components/SideNav/Analysis/analysis-panel/analysis-panel.component";
import { GraphSectionComponent } from './components/Blocks/graph-section/graph-section.component';
import { NgChartsModule } from 'ng2-charts';
import {LinkAnalysisPanelComponent} from "./components/SideNav/Analysis/link-analysis-panel/link-analysis-panel.component";
import {CompoundLinkAnalysisPanelComponent} from "./components/SideNav/Analysis/compound-link-analysis-panel/compound-link-analysis-panel.component";
import {CompoundLinkEditPanelComponent} from "./components/SideNav/Edit/compound-link-edit-panel/compound-link-edit-panel.component";
import { SynthesisPanelComponent } from './components/SideNav/Synthesis/synthesis-panel/synthesis-panel.component';
import { ThreePosSynthesis } from './components/SideNav/Synthesis/three-pos-synthesis/three-pos-synthesis.component';
import { PathSynthesis } from './components/SideNav/Synthesis/path-synthesis/path-synthesis.component';
import { RadioComponent } from './components/Blocks/radio/radio.component';
import { SingleInputComponent } from './components/Blocks/single-input/single-input.coponent';
import { AnimationBarComponent } from './components/AnimationBar/animationbar/animationbar.component';
import {AnalysisGraphButtonComponent} from "./components/Blocks/analysis-graph-button/analysis-graph-button.component";
import {ExportDataComponent} from "./components/Blocks/export-data/export-data.component";
import { ImportDataComponent } from "./components/Blocks/import-data/import-data.component";

import { SettingsPanelComponent } from './components/ToolBar/settings-panel/settings-panel.component';
import { TemplatesPanelComponent } from './components/ToolBar/templates-panel/templates-panel.component';
import { TutorialsPanelComponent } from './components/ToolBar/tutorials-panel/tutorials-panel.component';
import {FeedbackPanelComponent} from "./components/ToolBar/feedback-panel/feedback-panel.component";
import {SavePanelComponent} from "./components/ToolBar/save-panel/save-panel.component";
import {SharePanelComponent} from "./components/ToolBar/share-panel/share-panel.component";
import {MatListModule} from "@angular/material/list";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatSliderModule} from "@angular/material/slider";

import { PositionComponent } from './components/Grid/position/position.component';
import {TrajectoryComponent} from './components/Grid/trajectory/trajectory.component';
import {NgOptimizedImage} from "@angular/common";

@NgModule({
  declarations: [
    InteractionDirective,
    AppComponent,
    ContextMenuComponent,
    SvgComponent,
    GraphComponent,
    GridLinesComponent,
    JointComponent,
    jointEditPanelComponent,
    LinkComponent,
    CompoundLinkComponent,
    CreateNewCompLineComponent,
    ToolbarComponent,
    SidenavComponent,
    EditPanelComponent,
    AnimationBarComponent,
    AnalysisGraphButtonComponent,
    AnalysisPanelComponent,
    CompoundLinkEditPanelComponent,
    CompoundLinkAnalysisPanelComponent,
    LinkAnalysisPanelComponent,
    GraphSectionComponent,
    LinkEditPanelComponent,
    PanelSectionCollapsibleComponent,
    TriButtonComponent,
    DualButtonComponent,
    JointAnalysisPanelComponent,
    ToggleComponent,
    PanelSectionComponent,
    TitleBlock,
    CollapsibleSubsectionComponent,
    DualInputComponent,
    ToggleComponent,
    TriButtonComponent,
    DualButtonComponent,
    JointAnalysisPanelComponent,
    AnalysisPanelComponent,
    SynthesisPanelComponent,
    ThreePosSynthesis,
    PathSynthesis,
    RadioComponent,
    SingleInputComponent,
    CompoundLinkEditPanelComponent,
    ExportDataComponent,
    ImportDataComponent,
    SettingsPanelComponent,
    TemplatesPanelComponent,
    TutorialsPanelComponent,
    PositionComponent,
    TrajectoryComponent,
  ],
    imports: [
        BrowserModule,
        MatMenuModule,
        BrowserAnimationsModule,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatSidenavModule,
        MatButtonToggleModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatTooltipModule,
        MatSlideToggleModule,
        MatInputModule,
        FormsModule,
        NgChartsModule,
        MatListModule,
        MatExpansionModule,
        MatCheckboxModule,
        MatSliderModule,
        NgOptimizedImage,
    ],
  providers: [],
  exports: [
    PanelSectionCollapsibleComponent,
    TitleBlock
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
