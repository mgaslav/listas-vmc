import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-carga-pdf',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carga-pdf.component.html',
  styleUrls: ['./carga-pdf.component.css']
})
export class CargaPdfComponent {
  @Output() fileSelected = new EventEmitter<File>();
  @Output() startProcessing = new EventEmitter<void>();

  dragOver = false;
  selectedFile: File | null = null;
  errorMessage: string | null = null;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      this.errorMessage = 'Por favor, selecciona únicamente archivos PDF de la Guía de Actividades.';
      this.selectedFile = null;
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      this.errorMessage = 'El archivo supera el tamaño máximo permitido de 10 MB.';
      this.selectedFile = null;
      return;
    }

    this.errorMessage = null;
    this.selectedFile = file;
    this.fileSelected.emit(file);
  }

  removeFile(): void {
    this.selectedFile = null;
    this.errorMessage = null;
  }

  triggerUpload(): void {
    if (this.selectedFile) {
      this.startProcessing.emit();
    }
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
