#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Kick Event Analyzer
 * Analyzes collected event logs to generate definitions and statistics
 */

class KickEventAnalyzer {
  constructor(logFile) {
    this.logFile = logFile;
    this.eventSamples = new Map(); // Store samples per event type
    this.eventTypes = new Map();
    this.channelTypes = new Map();
    this.eventDefinitions = new Map();
    this.totalEventsProcessed = 0;
    this.maxSamplesPerType = 100; // Keep up to 100 samples per event type
  }

  async loadEvents() {
    if (!fs.existsSync(this.logFile)) {
      throw new Error(`Log file not found: ${this.logFile}`);
    }

    console.log(`Loading events from ${this.logFile}...`);

    const fileStream = fs.createReadStream(this.logFile);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineCount = 0;
    let processedCount = 0;

    for await (const line of rl) {
      lineCount++;

      if (line.trim() === '') continue;

      try {
        const event = JSON.parse(line);

        // Enhanced event type classification
        const eventType = this.getDetailedEventType(event);
        this.eventTypes.set(eventType, (this.eventTypes.get(eventType) || 0) + 1);

        // Store samples per event type (up to maxSamplesPerType for each type)
        if (!this.eventSamples.has(eventType)) {
          this.eventSamples.set(eventType, []);
        }
        const samples = this.eventSamples.get(eventType);
        if (samples.length < this.maxSamplesPerType) {
          samples.push(event);
        }

        // Count channel types
        const channelType = this.getChannelType(event.channel);
        this.channelTypes.set(channelType, (this.channelTypes.get(channelType) || 0) + 1);

        processedCount++;

        // Progress indicator for large files
        if (processedCount % 100000 === 0) {
          console.log(`  Processed ${processedCount} events...`);
        }

      } catch (error) {
        console.warn('Skipping malformed line:', line.substring(0, 100));
      }
    }

    this.totalEventsProcessed = processedCount;
    console.log(`✓ Processed ${processedCount} events from ${lineCount} lines`);

    const totalSamples = Array.from(this.eventSamples.values()).reduce((sum, samples) => sum + samples.length, 0);
    console.log(`✓ Keeping ${totalSamples} sample events across ${this.eventSamples.size} event types`);
  }

  getDetailedEventType(event) {
    const baseEventType = event.event;
    
    // Dynamic classification for ChatMessageEvent - discovers ANY type
    if (baseEventType === 'App\\Events\\ChatMessageEvent' && event.data) {
      const data = event.data;
      
      // Always classify by the actual type field, whatever it is
      if (data.type) {
        // Special handling for celebration types - dig deeper into metadata
        if (data.type === 'celebration' && data.metadata?.celebration?.type) {
          const celebrationType = data.metadata.celebration.type;
          return `App\\Events\\ChatMessageEvent (${data.type} - ${celebrationType})`;
        }
        
        // For known types, use friendlier names
        if (data.type === 'message') {
          return `App\\Events\\ChatMessageEvent (regular)`;
        }
        
        // For ANY other type (including unknown ones), preserve the original type name
        return `App\\Events\\ChatMessageEvent (${data.type})`;
      }
    }
    
    // For other event types, also check if they have subtypes in their data
    if (event.data && typeof event.data === 'object') {
      // Look for common subtype indicators
      if (event.data.type && typeof event.data.type === 'string') {
        return `${baseEventType} (${event.data.type})`;
      }
      if (event.data.event_type && typeof event.data.event_type === 'string') {
        return `${baseEventType} (${event.data.event_type})`;
      }
      if (event.data.subtype && typeof event.data.subtype === 'string') {
        return `${baseEventType} (${event.data.subtype})`;
      }
    }
    
    return baseEventType;
  }

  getChannelType(channel) {
    if (channel.startsWith('channel.') || channel.startsWith('channel_')) {
      return 'channel';
    } else if (channel.startsWith('chatrooms.') || channel.startsWith('chatroom_')) {
      return 'chatroom';
    } else if (channel.startsWith('private-livestream.')) {
      return 'livestream';
    } else if (channel.startsWith('private-')) {
      return 'private';
    }
    return 'unknown';
  }

  analyzeEvents() {
    console.log('\n📊 Event Analysis Results\n');
    
    // Event type statistics
    console.log('=== Event Types ===');
    const sortedEventTypes = [...this.eventTypes.entries()]
      .sort((a, b) => b[1] - a[1]);
    
    for (const [eventType, count] of sortedEventTypes) {
      console.log(`${eventType}: ${count}`);
      this.analyzeEventStructure(eventType);
    }
    
    // Channel type statistics
    console.log('\n=== Channel Types ===');
    for (const [channelType, count] of [...this.channelTypes.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`${channelType}: ${count}`);
    }
  }

  analyzeEventStructure(eventType) {
    const samples = this.eventSamples.get(eventType) || [];

    if (samples.length === 0) {
      console.warn(`No samples found for event type: ${eventType}`);
      return;
    }

    const structure = this.extractStructure(samples[0].data);
    this.eventDefinitions.set(eventType, {
      count: this.eventTypes.get(eventType),
      structure: structure,
      samples: samples.slice(0, 2).map(s => s.data) // Include 2 samples max
    });
  }

  extractStructure(data, depth = 0) {
    if (depth > 3) return '...'; // Prevent deep recursion
    
    if (data === null || data === undefined) {
      return null;
    }
    
    if (Array.isArray(data)) {
      if (data.length === 0) return [];
      return [this.extractStructure(data[0], depth + 1)];
    }
    
    if (typeof data === 'object') {
      const structure = {};
      for (const [key, value] of Object.entries(data)) {
        structure[key] = this.extractStructure(value, depth + 1);
      }
      return structure;
    }
    
    return typeof data;
  }

  generateDefinitions() {
    console.log('\n📝 Generating Event Definitions\n');
    
    const totalSamples = Array.from(this.eventSamples.values()).reduce((sum, samples) => sum + samples.length, 0);
    const definitions = {
      generated: new Date().toISOString(),
      totalEvents: this.totalEventsProcessed,
      sampleEvents: totalSamples,
      eventTypeCount: this.eventSamples.size,
      eventTypes: Object.fromEntries(this.eventTypes),
      channelTypes: Object.fromEntries(this.channelTypes),
      definitions: {}
    };

    for (const [eventType, info] of this.eventDefinitions) {
      definitions.definitions[eventType] = {
        description: this.getEventDescription(eventType),
        count: info.count,
        structure: info.structure,
        channels: this.getChannelsForEvent(eventType),
        samples: info.samples.slice(0, 2) // Include 2 samples
      };
    }

    return definitions;
  }

  getEventDescription(eventType) {
    const descriptions = {
      'App\\Events\\ChatMessageEvent': 'Chat message sent in a chatroom',
      'App\\Events\\ChatMessageEvent (regular)': 'Regular chat message',
      'App\\Events\\ChatMessageEvent (reply)': 'Reply to another chat message',
      'App\\Events\\ChatMessageEvent (celebration)': 'Celebration message (subscriptions, donations, etc.)',
      'App\\Events\\ChatMessageEvent (celebration - subscription_renewed)': 'Subscription renewal celebration',
      'App\\Events\\ChatMessageEvent (celebration - subscription_started)': 'New subscription celebration',
      'App\\Events\\ChatMessageEvent (celebration - donation)': 'Donation celebration',
      'App\\Events\\MessageDeletedEvent': 'Chat message was deleted by moderator',
      'App\\Events\\UserBannedEvent': 'User was banned from the chatroom',
      'App\\Events\\UserUnbannedEvent': 'User was unbanned from the chatroom',
      'App\\Events\\StreamerIsLive': 'Streamer went live',
      'App\\Events\\StopStreamBroadcast': 'Streamer stopped broadcasting',
      'App\\Events\\LivestreamUpdated': 'Livestream information was updated',
      'App\\Events\\PinnedMessageCreatedEvent': 'Message was pinned in chat',
      'App\\Events\\PinnedMessageDeletedEvent': 'Pinned message was removed',
      'App\\Events\\ChatroomUpdatedEvent': 'Chatroom settings were updated',
      'App\\Events\\PollUpdateEvent': 'Chat poll was updated',
      'App\\Events\\PollDeleteEvent': 'Chat poll was deleted',
      'App\\Events\\FollowersUpdated': 'Follower count changed',
      'App\\Events\\SubEvent': 'User subscribed to channel',
      'App\\Events\\GiftedSubEvent': 'User gifted a subscription',
      'App\\Events\\HostRaidEvent': 'Channel was hosted/raided',
      'GoalProgressUpdateEvent': 'Channel goal progress update (followers, donations, etc.)',
    };
    
    // If we have a known description, use it
    if (descriptions[eventType]) {
      return descriptions[eventType];
    }
    
    // Dynamic description generation for unknown types
    if (eventType.includes('ChatMessageEvent (')) {
      const match = eventType.match(/ChatMessageEvent \((.+)\)/);
      if (match) {
        const subtype = match[1];
        if (subtype.includes(' - ')) {
          const [mainType, detailType] = subtype.split(' - ');
          return `Chat message: ${mainType} event (${detailType})`;
        }
        return `Chat message: ${subtype} type`;
      }
    }
    
    // Generic pattern for other events with subtypes
    if (eventType.includes(' (')) {
      const match = eventType.match(/(.+) \((.+)\)/);
      if (match) {
        const [, baseType, subtype] = match;
        return `${baseType.replace(/App\\Events\\/, '')} - ${subtype} variant`;
      }
    }
    
    return `Unknown event type: ${eventType}`;
  }

  getChannelsForEvent(eventType) {
    const channels = new Set();
    const samples = this.eventSamples.get(eventType) || [];

    samples.forEach(e => channels.add(this.getChannelType(e.channel)));

    return [...channels];
  }

  saveResults(outputFile) {
    const definitions = this.generateDefinitions();
    
    fs.writeFileSync(outputFile, JSON.stringify(definitions, null, 2));
    console.log(`📁 Event definitions saved to: ${outputFile}`);
    
    // Also save a more readable markdown version
    const mdFile = outputFile.replace('.json', '.md');
    const markdown = this.generateMarkdownReport(definitions);
    fs.writeFileSync(mdFile, markdown);
    console.log(`📁 Markdown report saved to: ${mdFile}`);
  }

  generateMarkdownReport(definitions) {
    let md = '# Kick Event Definitions\n\n';
    md += `Generated: ${definitions.generated}\n`;
    md += `Total Events Processed: ${definitions.totalEvents}\n`;
    md += `Event Types Discovered: ${definitions.eventTypeCount}\n`;
    md += `Sample Events for Analysis: ${definitions.sampleEvents}\n\n`;
    
    md += '## Event Type Statistics\n\n';
    for (const [eventType, count] of Object.entries(definitions.eventTypes)) {
      md += `- **${eventType}**: ${count} events\n`;
    }
    
    md += '\n## Channel Type Distribution\n\n';
    for (const [channelType, count] of Object.entries(definitions.channelTypes)) {
      md += `- **${channelType}**: ${count} events\n`;
    }
    
    md += '\n## Event Definitions\n\n';
    for (const [eventType, info] of Object.entries(definitions.definitions)) {
      md += `### ${eventType}\n\n`;
      md += `**Description**: ${info.description}\n\n`;
      md += `**Count**: ${info.count}\n\n`;
      md += `**Channels**: ${info.channels.join(', ')}\n\n`;
      
      if (info.structure) {
        md += `**Data Structure**:\n\`\`\`json\n${JSON.stringify(info.structure, null, 2)}\n\`\`\`\n\n`;
      }
      
      if (info.samples && info.samples.length > 0) {
        md += `**Sample Data**:\n\`\`\`json\n${JSON.stringify(info.samples[0], null, 2)}\n\`\`\`\n\n`;
      }
      
      md += '---\n\n';
    }
    
    return md;
  }

  async run() {
    try {
      await this.loadEvents();
      this.analyzeEvents();

      const timestamp = new Date().toISOString().slice(0, 10);
      const outputFile = `kick-event-definitions-${timestamp}.json`;
      this.saveResults(outputFile);

    } catch (error) {
      console.error('Analysis failed:', error.message);
      process.exit(1);
    }
  }
}

// Command line usage
if (require.main === module) {
  const logFile = process.argv[2];

  if (!logFile) {
    console.log('Usage: node event-analyzer.js <log-file.jsonl>');
    process.exit(1);
  }

  const analyzer = new KickEventAnalyzer(logFile);
  analyzer.run().catch(error => {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  });
}

module.exports = KickEventAnalyzer;