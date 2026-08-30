// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  isAuthenticated,
  loadStoredUser,
  loginAs,
  logout,
  saveUser,
  startSession,
} from "./userStore";

beforeEach(() => {
  window.localStorage.clear();
});

describe("demo session vs profile", () => {
  it("is not authenticated just because a profile is saved", () => {
    saveUser(loadStoredUser());
    expect(window.localStorage.getItem("canvasClone:user")).toBeTruthy();
    expect(isAuthenticated()).toBe(false);
  });

  it("loginAs starts a session and logout clears it without wiping the profile", () => {
    loginAs("instructor");
    expect(isAuthenticated()).toBe(true);
    const name = loadStoredUser().name;

    logout();
    expect(isAuthenticated()).toBe(false);
    expect(loadStoredUser().name).toBe(name);
  });

  it("startSession authenticates without changing the profile", () => {
    const before = loadStoredUser();
    startSession();
    expect(isAuthenticated()).toBe(true);
    expect(loadStoredUser().name).toBe(before.name);
  });
});
