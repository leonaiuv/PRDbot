'use client';

import { useState } from 'react';
import { Tag, X, Check } from 'lucide-react';
import { PROJECT_TAGS, type ProjectTagId } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ProjectTagSelectorProps {
  selectedTags: ProjectTagId[];
  onTagsChange: (tags: ProjectTagId[]) => void;
  compact?: boolean;
}

export function ProjectTagSelector({
  selectedTags,
  onTagsChange,
  compact = false,
}: ProjectTagSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleTag = (tagId: ProjectTagId) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter((t) => t !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={cn(
            'justify-start gap-2',
            compact && 'h-7 px-2 text-xs'
          )}
        >
          <Tag className={cn('h-4 w-4', compact && 'h-3 w-3')} />
          {selectedTags.length === 0 ? (
            <span className="text-muted-foreground">添加标签</span>
          ) : (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedTags.slice(0, compact ? 1 : 2).map((tagId) => {
                const tag = PROJECT_TAGS.find((t) => t.id === tagId);
                if (!tag) return null;
                return (
                  <Badge
                    key={tagId}
                    variant="secondary"
                    className={cn(
                      'text-[10px] px-1.5 py-0 gap-1',
                      compact && 'text-[9px] px-1'
                    )}
                  >
                    <span
                      className={cn('w-1.5 h-1.5 rounded-full', tag.color)}
                    />
                    {tag.label}
                  </Badge>
                );
              })}
              {selectedTags.length > (compact ? 1 : 2) && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  +{selectedTags.length - (compact ? 1 : 2)}
                </Badge>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {PROJECT_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                  'hover:bg-muted',
                  isSelected && 'bg-muted'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', tag.color)} />
                <span className="flex-1 text-left">{tag.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 用于显示标签列表的组件
interface ProjectTagsDisplayProps {
  tags: ProjectTagId[];
  maxDisplay?: number;
  onRemove?: (tagId: ProjectTagId) => void;
  size?: 'sm' | 'default';
}

export function ProjectTagsDisplay({
  tags,
  maxDisplay = 3,
  onRemove,
  size = 'default',
}: ProjectTagsDisplayProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.slice(0, maxDisplay).map((tagId) => {
        const tag = PROJECT_TAGS.find((t) => t.id === tagId);
        if (!tag) return null;
        return (
          <Badge
            key={tagId}
            variant="secondary"
            className={cn(
              'gap-1',
              size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', tag.color)} />
            {tag.label}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(tagId);
                }}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        );
      })}
      {tags.length > maxDisplay && (
        <Badge
          variant="secondary"
          className={cn(
            size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'
          )}
        >
          +{tags.length - maxDisplay}
        </Badge>
      )}
    </div>
  );
}

// 用于首页筛选的标签过滤器
interface ProjectTagFilterProps {
  selectedTags: ProjectTagId[];
  onTagsChange: (tags: ProjectTagId[]) => void;
}

export function ProjectTagFilter({
  selectedTags,
  onTagsChange,
}: ProjectTagFilterProps) {
  const toggleTag = (tagId: ProjectTagId) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter((t) => t !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  const clearAll = () => {
    onTagsChange([]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PROJECT_TAGS.map((tag) => {
        const isSelected = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all',
              'border hover:shadow-sm',
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', tag.color)} />
            {tag.label}
          </button>
        );
      })}
      {selectedTags.length > 0 && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          清除筛选
        </button>
      )}
    </div>
  );
}
