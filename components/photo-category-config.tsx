"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Camera } from "lucide-react"
import type { PhotoCategory } from "@/lib/task-definitions"

interface PhotoCategoryConfigProps {
  photoRequired: boolean
  photoCount: number
  photoDocumentationRequired: boolean
  categories: PhotoCategory[]
  onChange: (config: {
    photoRequired: boolean
    photoCount: number
    photoDocumentationRequired: boolean
    categories: PhotoCategory[]
  }) => void
}

const TEMPLATES = [
  {
    name: "Before/After",
    categories: [
      { name: "Before", count: 1, description: "Initial state before work" },
      { name: "After", count: 1, description: "Final state after completion" },
    ],
  },
  {
    name: "Initial/Progress/Final",
    categories: [
      { name: "Initial State", count: 1, description: "Starting condition" },
      { name: "During Work", count: 1, description: "Work in progress" },
      { name: "Final Result", count: 1, description: "Completed work" },
    ],
  },
  {
    name: "Room/Proof",
    categories: [
      { name: "Room Photos", count: 1, description: "Full room overview" },
      { name: "Proof Photos", count: 1, description: "Proof of completion" },
    ],
  },
]

export function PhotoCategoryConfig({
  photoRequired,
  photoCount,
  photoDocumentationRequired,
  categories,
  onChange,
}: PhotoCategoryConfigProps) {
  const [showTemplates, setShowTemplates] = useState(categories.length === 0 && photoDocumentationRequired)

  const handlePhotoRequiredChange = (checked: boolean) => {
    onChange({
      photoRequired: checked,
      photoCount: checked ? photoCount || 1 : 0,
      photoDocumentationRequired: false, // Disable documentation when simple photo is enabled
      categories: [],
    })
  }

  const handlePhotoDocumentationChange = (checked: boolean) => {
    onChange({
      photoRequired: false, // Disable simple photo when documentation is enabled
      photoCount: 0,
      photoDocumentationRequired: checked,
      categories: checked ? categories : [],
    })
    if (checked && categories.length === 0) {
      setShowTemplates(true)
    }
  }

  const handlePhotoCountChange = (count: number) => {
    onChange({
      photoRequired,
      photoCount: count,
      photoDocumentationRequired,
      categories,
    })
  }

  const handleAddCategory = () => {
    onChange({
      photoRequired,
      photoCount,
      photoDocumentationRequired,
      categories: [...categories, { name: "", count: 1, description: "" }],
    })
  }

  const handleRemoveCategory = (index: number) => {
    onChange({
      photoRequired,
      photoCount,
      photoDocumentationRequired,
      categories: categories.filter((_, i) => i !== index),
    })
  }

  const handleUpdateCategory = (index: number, field: keyof PhotoCategory, value: string | number) => {
    const updated = [...categories]
    updated[index] = { ...updated[index], [field]: value }
    onChange({
      photoRequired,
      photoCount,
      photoDocumentationRequired,
      categories: updated,
    })
  }

  const handleApplyTemplate = (template: (typeof TEMPLATES)[0]) => {
    onChange({
      photoRequired,
      photoCount,
      photoDocumentationRequired,
      categories: template.categories,
    })
    setShowTemplates(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Simple Photo Required */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg">
            <Checkbox
              id="photo-required"
              checked={photoRequired}
              onCheckedChange={handlePhotoRequiredChange}
              disabled={photoDocumentationRequired}
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="photo-required" className="text-sm font-medium cursor-pointer">
                Photo Required
              </Label>
              <p className="text-xs text-muted-foreground">
                Simple photo requirement - workers just need to upload photos without specific categories
              </p>
              {photoRequired && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="photo-count" className="text-xs">
                    Number of Photos
                  </Label>
                  <Input
                    id="photo-count"
                    type="number"
                    min="1"
                    max="10"
                    value={photoCount}
                    onChange={(e) => handlePhotoCountChange(Number.parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Photo Documentation Required */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg">
            <Checkbox
              id="photo-documentation"
              checked={photoDocumentationRequired}
              onCheckedChange={handlePhotoDocumentationChange}
              disabled={photoRequired}
            />
            <div className="flex-1">
              <Label htmlFor="photo-documentation" className="text-sm font-medium cursor-pointer">
                Photo Documentation Required
              </Label>
              <p className="text-xs text-muted-foreground">
                Categorized photo documentation - workers upload photos for specific categories (Before/After,
                Room/Proof, etc.)
              </p>
            </div>
          </div>

          {!photoRequired && !photoDocumentationRequired && (
            <p className="text-xs text-muted-foreground text-center py-2">No photos required for this task</p>
          )}
        </CardContent>
      </Card>

      {/* Photo Documentation Configuration */}
      {photoDocumentationRequired && (
        <>
          {showTemplates ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Photo Documentation Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Choose a template or create custom photo categories:</p>
                <div className="grid gap-3">
                  {TEMPLATES.map((template) => (
                    <Button
                      key={template.name}
                      variant="outline"
                      className="justify-start h-auto p-4 bg-transparent"
                      onClick={() => handleApplyTemplate(template)}
                    >
                      <div className="text-left w-full">
                        <div className="font-semibold mb-1">{template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {template.categories.map((c) => c.name).join(" → ")}
                        </div>
                      </div>
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4 bg-transparent"
                    onClick={() => {
                      setShowTemplates(false)
                      handleAddCategory()
                    }}
                  >
                    <div className="text-left w-full">
                      <div className="font-semibold mb-1">Custom Categories</div>
                      <div className="text-xs text-muted-foreground">Define your own photo categories</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Photo Categories</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowTemplates(true)}>
                    Use Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No photo categories defined</p>
                    <Button variant="outline" size="sm" className="mt-4 bg-transparent" onClick={handleAddCategory}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {categories.map((category, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant="outline" className="shrink-0">
                              Category {index + 1}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveCategory(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`category-name-${index}`}>Category Name *</Label>
                            <Input
                              id={`category-name-${index}`}
                              placeholder="e.g., Before, After, Room, Proof"
                              value={category.name}
                              onChange={(e) => handleUpdateCategory(index, "name", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`category-count-${index}`}>Minimum Photos Required</Label>
                            <Input
                              id={`category-count-${index}`}
                              type="number"
                              min="1"
                              max="10"
                              value={category.count}
                              onChange={(e) =>
                                handleUpdateCategory(index, "count", Number.parseInt(e.target.value) || 1)
                              }
                              className="w-24"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`category-desc-${index}`}>Description (optional)</Label>
                            <Textarea
                              id={`category-desc-${index}`}
                              placeholder="Help text for workers"
                              value={category.description || ""}
                              onChange={(e) => handleUpdateCategory(index, "description", e.target.value)}
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button variant="outline" size="sm" onClick={handleAddCategory} className="w-full bg-transparent">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Another Category
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
