import { Injectable } from '@nestjs/common';
import {
  DEFAULT_EMAIL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  COMMON_VARIABLES,
  EmailTemplateData,
} from './email-templates.constants';

@Injectable()
export class EmailTemplatesService {
  getDefaultTemplates(): EmailTemplateData[] {
    return DEFAULT_EMAIL_TEMPLATES;
  }

  getTemplatesByCategory(category: string): EmailTemplateData[] {
    return DEFAULT_EMAIL_TEMPLATES.filter((template) => template.category === category);
  }

  getTemplateById(id: string): EmailTemplateData | undefined {
    return DEFAULT_EMAIL_TEMPLATES.find((template) => template.id === id);
  }

  getTemplateCategories() {
    return TEMPLATE_CATEGORIES;
  }

  getCommonVariables() {
    return COMMON_VARIABLES;
  }

  getDefaultTemplatesForCategory(category: string): EmailTemplateData[] {
    return DEFAULT_EMAIL_TEMPLATES.filter(
      (template) => template.category === category && template.isDefault,
    );
  }

  searchTemplates(query: string): EmailTemplateData[] {
    const lowerQuery = query.toLowerCase();
    return DEFAULT_EMAIL_TEMPLATES.filter(
      (template) =>
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description?.toLowerCase().includes(lowerQuery) ||
        template.subject.toLowerCase().includes(lowerQuery),
    );
  }

  validateTemplate(template: Partial<EmailTemplateData>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.subject || template.subject.trim().length === 0) {
      errors.push('Template subject is required');
    }

    if (!template.content || template.content.trim().length === 0) {
      errors.push('Template content is required');
    }

    if (!template.category) {
      errors.push('Template category is required');
    } else if (!TEMPLATE_CATEGORIES.some((cat) => cat.value === template.category)) {
      errors.push('Invalid template category');
    }

    // Check for valid variable syntax in subject and content
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();

    if (template.subject) {
      let match;
      while ((match = variableRegex.exec(template.subject)) !== null) {
        variables.add(match[1] as string);
      }
    }

    if (template.content) {
      let match;
      while ((match = variableRegex.exec(template.content)) !== null) {
        variables.add(match[1] as string);
      }
    }

    // Update variables array based on found variables
    if (template.variables) {
      const foundVariables = Array.from(variables);
      const missingInContent = template.variables.filter((v) => !foundVariables.includes(v));
      const missingInArray = foundVariables.filter((v) => !template.variables!.includes(v));

      if (missingInContent.length > 0) {
        errors.push(`Variables listed but not used in template: ${missingInContent.join(', ')}`);
      }

      if (missingInArray.length > 0) {
        errors.push(`Variables used in template but not listed: ${missingInArray.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  processTemplate(
    template: EmailTemplateData,
    variables: Record<string, string>,
  ): { subject: string; content: string } {
    let processedSubject = template.subject;
    let processedContent = template.content;

    // Replace variables in subject and content
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedSubject = processedSubject.replace(regex, value || '');
      processedContent = processedContent.replace(regex, value || '');
    });

    return {
      subject: processedSubject,
      content: processedContent,
    };
  }

  extractVariablesFromTemplate(subject: string, content: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();

    let match;
    while ((match = variableRegex.exec(subject)) !== null) {
      variables.add(match[1] as string);
    }

    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1] as string);
    }

    return Array.from(variables).sort();
  }
}
