'use client';

import { useState } from 'react';
import { PRD_TEMPLATES, TEMPLATE_CATEGORIES, type PRDTemplate } from '@/lib/templates';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TemplateSelectorProps {
  selectedTemplate: PRDTemplate | null;
  onSelectTemplate: (template: PRDTemplate) => void;
}

export function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredTemplates = activeCategory === 'all' 
    ? PRD_TEMPLATES 
    : PRD_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* 分类标签 */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all',
              'hover:bg-muted',
              activeCategory === category.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground'
            )}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* 模板列表 */}
      <ScrollArea className="h-[280px] pr-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className={cn(
                'text-left p-4 rounded-lg border-2 transition-all hover:shadow-md',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                selectedTemplate?.id === template.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{template.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags.slice(0, 3).map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
