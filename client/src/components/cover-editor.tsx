import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RotateCw, ZoomIn, Check, X } from "lucide-react";

interface CoverEditorProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (croppedImage: string) => void;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation: number): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const rotRad = (rotation * Math.PI) / 180;

  const bBoxWidth = Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height);
  const bBoxHeight = Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("No 2d context");
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return croppedCanvas.toDataURL("image/jpeg", 0.9);
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

export function CoverEditor({ open, onClose, imageSrc, onSave }: CoverEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onSave(croppedImage);
      onClose();
    } catch (e) {
      console.error(e);
    }
  }, [croppedAreaPixels, imageSrc, rotation, onSave, onClose]);

  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="font-serif text-xl">Edit Cover Image</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* Cropper Area */}
          <div className="flex-1 relative bg-zinc-900 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={2 / 3}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              cropShape="rect"
              showGrid={true}
            />
          </div>

          {/* Controls & Preview */}
          <div className="w-72 flex flex-col gap-6">
            {/* Store Preview */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Store Preview</Label>
              <div className="bg-muted rounded-lg p-4 flex justify-center">
                <div className="w-32 aspect-[2/3] rounded-md overflow-hidden shadow-lg book-shadow relative bg-zinc-200">
                  <img
                    src={imageSrc}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    style={{
                      transform: `rotate(${rotation}deg) scale(${zoom})`,
                      transformOrigin: "center",
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                How your cover will appear in the marketplace
              </p>
            </div>

            {/* Zoom Control */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ZoomIn className="w-4 h-4" /> Zoom
                </Label>
                <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
              />
            </div>

            {/* Rotation Control */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <RotateCw className="w-4 h-4" /> Rotation
                </Label>
                <span className="text-xs text-muted-foreground">{rotation}°</span>
              </div>
              <div className="flex gap-2">
                <Slider
                  value={[rotation]}
                  min={0}
                  max={360}
                  step={1}
                  onValueChange={(value) => setRotation(value[0])}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={rotateRight} title="Rotate 90°">
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Aspect Ratio Info */}
            <div className="bg-accent/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Optimal Cover Size</p>
              <p>2:3 aspect ratio (e.g., 1600×2400px)</p>
              <p>Works best on Kindle, Apple Books, and Kobo.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
          <Button onClick={handleSave}>
            <Check className="w-4 h-4 mr-2" /> Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
