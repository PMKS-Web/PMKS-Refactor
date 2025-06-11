import {
  Component,
  Input,
  AfterViewInit,
  OnInit,
  ViewChild,
  ElementRef,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import {
  Chart,
  ChartOptions,
  Plugin
} from 'chart.js'

import { AnimationService } from 'src/app/services/animation.service';

// Plugin: draw animated vertical line
const verticalLinePlugin: Plugin = {
  id: 'verticalLine',
  afterDatasetsDraw: (chart: Chart) => {
    const ctx = chart.ctx;
    const xScale = chart.scales['x'];

    const currentStep = (chart as any).currentTimeStep;
    if (typeof currentStep !== 'number') return;

    const xPos = xScale.getPixelForValue(currentStep);
    if (!xPos) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xPos, chart.chartArea.top);
    ctx.lineTo(xPos, chart.chartArea.bottom);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
};

@Component({
  selector: 'app-analysis-graph-block',
  templateUrl: './graph-section.component.html',
  styleUrls: ['./graph-section.component.scss']
})
export class GraphSectionComponent implements AfterViewInit, OnInit, OnChanges {
  @Input() inputXData?: any[] = [{ data: [], label: 'X Position' }];
  @Input() inputYData?: any[] = [{ data: [], label: 'Y Position' }];
  @Input() inputLabels?: string[] = [""];
  @ViewChild('graphCanvas') graphCanvas!: ElementRef;

  @Input() view: [number, number] = [700, 400];
  @Input() colorScheme = { domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'] };
  @Input() gradient = false;
  @Input() showLegend = true;
  @Input() showXAxis = true;
  @Input() showYAxis = true;
  @Input() xAxisLabel = 'Time in Time Steps';
  @Input() yAxisLabel = '';

  public chart!: Chart;
  public showGrid: boolean = false;
  public showXCurve: boolean = true;  // New property for X curve visibility
  public showYCurve: boolean = true;  // New property for Y curve visibility
  // public showGrid: boolean = true; // Default: grid ON

  constructor(private animationService: AnimationService) {}

  public ChartOptions: any = {
    bezierCurve: true,
    tension: 0.3,
    responsive: true,
    hover: {
      mode: 'nearest',
    },
    elements: {
      point: {
        radius: 0,  // Hide points completely
      },
      line: {
        borderWidth: 3,        // Thicker line
        borderDash: [],        // Solid line
        fill: false,           // No fill area
        borderCapStyle: 'round', // Rounded line caps
        borderJoinStyle: 'round' // Rounded line joins
      },
    },
    animation: false,
    scales: {
      x: {
        display: true, // Will be set properly in ngOnInit
        title: {
          display: true,
          text: 'Time in Time Steps', // Will be updated in ngOnInit
          color: 'black',
          font: {
            weight: 'bold',
          },
        },
        grid: {
          display: true,  // Default to showing grid
        }
      },
      y: {
        display: true, // Will be set properly in ngOnInit
        title: {
          display: true,
          text: '', // Will be updated in ngOnInit
          color: 'black',
          font: {
            weight: 'bold',
          },
        },
        grid: {
          display: true,  // Default to showing grid
        },
        padding: {
          top: 10,
          bottom: 10,
        },
      },
    },
    legend: true, // Will be updated in ngOnInit
  };
  
  ngOnChanges(changes: SimpleChanges) {
    // Only update if chart exists and data inputs have changed
    if (this.chart && (changes['inputXData'] || changes['inputYData'] || changes['inputLabels'])) {
      this.updateChartData();
    }
  }

  private updateChartData() {
    if (!this.chart) return;
    
    // Update the chart's data directly instead of recreating
    this.chart.data.labels = this.inputLabels;
    
    // Build datasets array based on curve visibility
    const datasets = [];
    if (this.showXCurve && this.inputXData) {
      datasets.push(...this.inputXData);
    }
    if (this.showYCurve && this.inputYData) {
      datasets.push(...this.inputYData);
    }
    
    this.chart.data.datasets = datasets;
    
    // Update the chart
    this.chart.update();
  }

  ngOnInit() {
    // Update chart options with proper values
    this.ChartOptions.scales.x.display = this.showXAxis;
    this.ChartOptions.scales.y.display = this.showYAxis;
    this.ChartOptions.scales.x.title.text = this.xAxisLabel;
    this.ChartOptions.scales.y.title.text = this.yAxisLabel;
    this.ChartOptions.legend = this.showLegend;

    if (this.graphCanvas) {
      this.createChart();
    }
    
    this.animationService.currentFrameIndex$.subscribe(step => {
      console.log("step: " + step);
      this.updateGraphAtStep(step);
    });
  }

  ngAfterViewInit() {
    if (this.graphCanvas && !this.chart) {
      this.createChart();
    }
  }

  createChart() {
    const ctx: CanvasRenderingContext2D = this.graphCanvas.nativeElement.getContext('2d');
    console.log("Creating chart!");

    if (this.inputXData && this.inputYData) {
      // Build initial datasets based on curve visibility
      const datasets = [];
      if (this.showXCurve) {
        datasets.push(...this.inputXData);
      }
      if (this.showYCurve) {
        datasets.push(...this.inputYData);
      }

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.inputLabels,
          datasets: datasets
        },
        options: {
          ...(this.ChartOptions as ChartOptions),
        },
        plugins: [verticalLinePlugin]
      });
    }
  }

  public updateGraphAtStep(step: number) {
    if (!this.chart || !this.inputLabels) return;
    (this.chart as any).currentTimeStep = step;
    this.chart.update();
  }

  // New method to handle X curve toggle
  public onToggleXCurve(event: any): void {
    this.showXCurve = event.target.checked;
    this.updateChartData();
  }

  // New method to handle Y curve toggle
  public onToggleYCurve(event: any): void {
    this.showYCurve = event.target.checked;
    this.updateChartData();
  }

  downloadCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";

    csvContent += "Time,X Data,Y Data\n";

    if (this.inputLabels && this.inputXData && this.inputYData) {
      for (let i = 0; i < this.inputLabels.length; i++) {
        let time = this.inputLabels[i] || "";
        let xData = this.inputXData[0]?.data[i] ?? "";
        let yData = this.inputYData[0]?.data[i] ?? "";

        csvContent += `${time},${xData},${yData}\n`;
      }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "graph_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  onToggleGrid(event: any): void {
    this.showGrid = event.target.checked;
    if (this.chart) {
      this.chart.destroy();
      this.createChart();
    }
  }

  public downloadPNG() {
    // Remove the red line temporarily
    Chart.unregister(verticalLinePlugin);

    // Redraw chart without red line
    this.chart.update();
    this.updateChartData();

    // Create PNG from canvas
    const originalCanvas = this.chart.canvas;
    const width = originalCanvas.width;
    const height = originalCanvas.height;

    // Create a temporary canvas with white background
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw the chart canvas onto the white canvas
    ctx.drawImage(originalCanvas, 0, 0);

    // Export to PNG
    const image = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = 'graph.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Restore vertical line and redraw
    Chart.register(verticalLinePlugin);
    this.chart.update();
    this.updateChartData();
  }
}