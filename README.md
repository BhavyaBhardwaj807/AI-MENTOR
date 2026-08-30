# 🎙️ Agora Meet — AI-Powered Real-Time Meeting Platform

A real-time meeting platform built with **Next.js** and **Agora RTC**, featuring an AI Mentor that can join meetings, listen to participants, understand conversations, and respond naturally using voice.

The project combines real-time audio/video communication with **Conversational AI** to create an interactive meeting experience.

---

## ✨ Features

- 🎥 **Real-time video meetings**
  - Audio and video communication using Agora RTC
  - Dynamic meeting rooms with unique channel IDs

- 🤖 **AI Mentor**
  - AI agent can join an active meeting
  - Listens to participant audio
  - Processes speech using ASR
  - Generates responses using an LLM
  - Responds using TTS

- 🗣️ **Natural Voice Interaction**
  - Real-time conversational interaction
  - Configurable TTS voice through the Agora Conversational AI pipeline

- 🎭 **AI Avatar Integration**
  - Integrated with Agora's LiveAvatar support
  - Avatar is configured as a separate RTC participant
  - Uses a dedicated Agora UID for avatar video

- 🔐 **Secure Server-Side API**
  - Agora REST credentials are kept server-side
  - RTC tokens are generated securely
  - Sensitive credentials are stored using environment variables

- 🧹 **Agent Lifecycle Management**
  - Automatically checks for existing agents in a meeting
  - Stops stale agents before starting a new one
  - Tracks active agents per meeting

- 🛠️ **Developer Diagnostics**
  - Detailed Agora agent startup logs
  - Agent status monitoring
  - Audio-level diagnostics
  - RTC publish/subscribe diagnostics

---

## 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │      Next.js App    │
                    │                     │
                    │  Meeting Interface  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Agora RTC       │
                    │                     │
                    │ Audio / Video Room  │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
             ▼                                   ▼
     ┌───────────────┐                  ┌─────────────────┐
     │   Participant │                  │   AI Mentor     │
     │               │                  │                 │
     │ Mic + Camera  │                  │ Agora Agent     │
     └───────────────┘                  └────────┬────────┘
                                                  │
                                                  ▼
                                      ┌─────────────────────┐
                                      │ Conversational AI   │
                                      │                     │
                                      │ ASR → LLM → TTS    │
                                      └──────────┬──────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────┐
                                      │     LiveAvatar      │
                                      │                     │
                                      │ Avatar RTC Video    │
                                      └─────────────────────┘
