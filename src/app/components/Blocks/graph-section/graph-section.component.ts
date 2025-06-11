import {
  Component,
  Input,
  AfterViewInit,
  OnInit,
  ViewChild,
  ElementRef
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
export class GraphSectionComponent implements AfterViewInit, OnInit {
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

  // public showGrid: boolean = true; // Default: grid ON

  constructor(private animationService: AnimationService) {}

  public ChartOptions: any = {
    bezierCurve: true,
    tension: 0.3,
    // scaleShowVerticalLines: true,
    // scaleShowHorizontalLines: false,
    responsive: true,
    hover: {
      mode: 'nearest',
    },
    elements: {
      point: {
        radius: 0.5,
      },
    },
    animation: false,
    scales: {
      x: {
        display: this.showXAxis,
        title: {
          display: true,
          text: this.xAxisLabel,
          color: 'black',
          font: {
            weight: 'bold',
          },
        },
        grid: {
          display: false,
        }
      },
      y: {
        display: this.showYAxis,
        title: {
          display: true,
          text: this.yAxisLabel,
          color: 'black',
          font: {
            weight: 'bold',
          },
        },
        grid: {
          display: false,
        },
        padding: {
          top: 10,
          bottom: 10,
        },
      },
    },
    legend: this.showLegend,
  };

  ngOnInit() {
    if (this.graphCanvas) {
      this.createChart();
    }

    this.animationService.currentFrameIndex$.subscribe(step => {
      console.log("step: " + step);
      this.updateGraphAtStep(step);
    });
  }

  ngAfterViewInit() {
    if (this.graphCanvas) {
      this.createChart();
    }
  }

  createChart() {
    const ctx: CanvasRenderingContext2D = this.graphCanvas.nativeElement.getContext('2d');
    console.log("Creating chart!");

    if (this.inputXData && this.inputYData) {
      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.inputLabels,
          datasets: [
            ...this.inputXData,
            ...this.inputYData,
          ]
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
    this.ChartOptions.scales.x.grid.display= event.target.checked;
    this.ChartOptions.scales.y.grid.display= event.target.checked;
    this.chart.update();
    this.updateChart();
  }

  updateChart(): void {


    if (this.chart) {
      this.chart.destroy();

      console.log("Chart destroyed!!!");
    }

    this.createChart();


  }

  public downloadPNG() {
    // Remove the red line temporarily
    Chart.unregister(verticalLinePlugin);

    // Redraw chart without red line
    this.chart.update();
    this.updateChart();

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

    // 🖼 Draw the chart canvas onto the white canvas
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
    this.updateChart();

  }


}
