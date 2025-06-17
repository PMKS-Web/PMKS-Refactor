import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { StateService } from '../../../services/state.service';
import { UrlGenerationService } from '../../../services/url-generation.service';
import { EncoderService } from '../../../services/encoder.service';
import { DecoderService } from '../../../services/decoder.service';
import { NotificationService } from 'src/app/services/notification.service';
import { PanZoomService } from '../../../services/pan-zoom.service';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent {
  constructor(
    private stateService: StateService,
    private notificationService: NotificationService,
    private panZoomService: PanZoomService
  ) {}
  @ViewChild('toolbarContainer', { static: false })
  toolbarContainer!: ElementRef;
  @ViewChild('toolbarButtons', { static: false }) toolbarButtons!: ElementRef;

  showNavArrows = false;
  currentScrollPosition = 0;
  maxScrollPosition = 0;
  scrollStep = 100; // pixels to scroll per click
  selectedPanel = '';
  private resizeObserver?: ResizeObserver;

  ngOnInit() {
    // Initialize resize observer to monitor container size changes
    this.initializeResizeObserver();
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  ngAfterViewInit() {
    // Check initial state after view is initialized
    setTimeout(() => {
      this.checkOverflow();
    }, 100);
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any) {
    this.checkOverflow();
  }

  private initializeResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.checkOverflow();
      });
    }
  }

  private checkOverflow() {
    if (!this.toolbarContainer || !this.toolbarButtons) return;
    console.log(this.showNavArrows);

    const container = this.toolbarContainer.nativeElement;
    const buttonsWrapper = this.toolbarButtons.nativeElement;

    const containerWidth = container.offsetWidth;
    const buttonsWidth = buttonsWrapper.scrollWidth;

    const overflowBuffer = 5;
    this.showNavArrows = buttonsWidth > containerWidth + overflowBuffer;

    // Calculate max scroll position
    this.maxScrollPosition = Math.max(0, buttonsWidth - containerWidth);

    // Ensure current position is within bounds
    this.currentScrollPosition = Math.min(
      this.currentScrollPosition,
      this.maxScrollPosition
    );

    // Apply current scroll position
    this.applyScrollPosition();

    // Start observing if not already
    if (this.resizeObserver && container) {
      this.resizeObserver.observe(container);
    }
  }

  scrollToolbar(direction: 'left' | 'right' | 'wheel-up' | 'wheel-down') {
    if (!this.showNavArrows) return;

    if (direction === 'left' || direction === 'wheel-up') {
      this.currentScrollPosition = Math.max(
        0,
        this.currentScrollPosition - this.scrollStep
      );
    } else {
      // 'right' or 'wheel-down'
      this.currentScrollPosition = Math.min(
        this.maxScrollPosition,
        this.currentScrollPosition + this.scrollStep
      );
    }

    this.applyScrollPosition();
  }

  // New method to handle mouse wheel events
  onMouseWheelScroll(event: WheelEvent) {
    if (event.deltaY > 0) {
      this.scrollToolbar('wheel-down');
    } else if (event.deltaY < 0) {
      this.scrollToolbar('wheel-up');
    }
    // Prevent default scrolling behavior if you only want this component to scroll horizontally
    event.preventDefault();
  }

  private applyScrollPosition() {
    if (!this.toolbarButtons) return;

    const buttonsWrapper = this.toolbarButtons.nativeElement;
    buttonsWrapper.style.transform = `translateX(-${this.currentScrollPosition}px)`;
  }

  // Optional: Add keyboard navigation
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!this.showNavArrows) return;

    if (event.key === 'ArrowLeft' && event.ctrlKey) {
      event.preventDefault();
      this.scrollToolbar('left');
    } else if (event.key === 'ArrowRight' && event.ctrlKey) {
      event.preventDefault();
      this.scrollToolbar('right');
    }
  }

  // Sets the currently active tab
  setCurrentTab(clickedPanel: string) {
    if (clickedPanel == this.selectedPanel) {
      this.selectedPanel = '';
    } else {
      this.selectedPanel = clickedPanel;
    }
  }

  // Returns the name of the currently selected panel
  getSelected(): string {
    return this.selectedPanel;
  }

  // Handles sharing functionality by copying the generated URL to the clipboard
  handleShare() {
    //this.setCurrentTab("Share");
    let urlService = new UrlGenerationService(
      this.stateService,
      this.panZoomService
    );
    urlService.copyURL();
    this.notificationService.showNotification(
      'Mechanism URL copied. If you make additional changes, copy the URL again.'
    );
  }

  // Handles sharing functionality by copying the generated URL to the clipboard
  handleSave() {
    //this.setCurrentTab("Save");
    console.log('save button pressed');
    let encoderService = new EncoderService(
      this.stateService,
      this.panZoomService
    );
    let csv: string = encoderService.exportMechanismDataToCSV();
    console.log(csv);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    a.download =
      'data-' +
      (date.getMonth() + 1).toLocaleString('en-US', {
        minimumIntegerDigits: 2,
      }) +
      date.getDate().toLocaleString('en-US', { minimumIntegerDigits: 2 }) +
      date.getHours().toLocaleString('en-US', { minimumIntegerDigits: 2 }) +
      date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits: 2 }) +
      '.csv';
    a.click();
    URL.revokeObjectURL(url);
    //todo notification of download
  }

  // Handles saving functionality by exporting data as CSV and triggering a file download
  handleLoadFile() {
    // Create a hidden file input object
    const fileInput: HTMLInputElement = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none'; // Keep it hidden
    document.body.appendChild(fileInput);
    // Handle the file selection
    fileInput.addEventListener('change', (event: Event): void => {
      const target = event.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) {
        return; // User canceled
      }

      const fileList = target.files;
      const file: File = fileList[0];
      const reader: FileReader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        // e.target can be null in some edge cases, so check before using
        if (!e.target) {
          return;
        }
        // The file contents as text
        const fileContents: string = e.target.result as string;
        console.log('File Contents:', fileContents);
        DecoderService.decodeFromCSV(fileContents, this.stateService);
      };

      // Read file content as text
      reader.readAsText(file);
    });
    fileInput.click();
  }
}
