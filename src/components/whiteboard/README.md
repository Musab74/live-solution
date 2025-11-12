# Whiteboard Module

## Overview
Backend module for whiteboard functionality - handles permissions, validation, and WebSocket events for whiteboard operations.

## Structure

### Files
- `whiteboard.module.ts` - NestJS module configuration
- `whiteboard.service.ts` - Business logic for whiteboard operations
- `whiteboard.resolver.ts` - GraphQL resolver for whiteboard queries/mutations

## Features

### WhiteboardService
- `canUseWhiteboard()` - Check if user (host) can use whiteboard
- `validateWhiteboardPermission()` - Validate host permission
- `getWhiteboardStatus()` - Get whiteboard status for a meeting

## GraphQL API

### Queries
- `canUseWhiteboard(input: CanUseWhiteboardInput!): Boolean!`
- `getWhiteboardStatus(meetingId: ID!): WhiteboardStatusResponse!`

## Integration

### WebSocket Events (Signaling Gateway)
The whiteboard will use WebSocket events for real-time updates:
- `WHITEBOARD_STARTED` - Host started whiteboard
- `WHITEBOARD_STOPPED` - Host stopped whiteboard
- `WHITEBOARD_CLEARED` - Host cleared whiteboard

These events will be added to `signaling.gateway.ts` when implementing the feature.

## Dependencies
- `AuthModule` - For authentication
- `MemberModule` - For user information
- `ParticipantModule` - For participant validation
- `SignalingModule` - For WebSocket events



