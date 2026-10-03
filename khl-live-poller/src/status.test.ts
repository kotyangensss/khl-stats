import assert from "node:assert/strict";
import test from "node:test";
import { statusFromCalendar, statusFromHeader } from "./status.ts";

test("an overdue scoreless game stays scheduled without live confirmation", () => {
  // Arrange
  const game = { approved: 0, homeScore: 0, visitorScore: 0 };

  // Act
  const status = statusFromCalendar(game, "SCHEDULED");

  // Assert
  assert.equal(status, "SCHEDULED");
});

test("a stale calendar does not downgrade a live game", () => {
  // Arrange
  const game = { approved: 0, homeScore: 0, visitorScore: 0 };

  // Act
  const status = statusFromCalendar(game, "LIVE");

  // Assert
  assert.equal(status, "LIVE");
});

test("an offline header without a final status does not finish a live game", () => {
  // Arrange
  const header = { isOnline: false, status: "Перерыв" };

  // Act
  const status = statusFromHeader(header, "LIVE");

  // Assert
  assert.equal(status, "LIVE");
});

test("an explicit final header finishes a live game", () => {
  // Arrange
  const header = { isOnline: false, status: "Матч завершен" };

  // Act
  const status = statusFromHeader(header, "LIVE");

  // Assert
  assert.equal(status, "FINISHED");
});
