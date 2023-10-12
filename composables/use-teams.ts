import { useAsyncData } from "#app";
import { computed, ref } from "vue";

export interface Team {
  name: string;
  services: TeamService[];
}

interface TeamService {
  name: string;
  color: TeamServiceColors;
}

type TeamServiceColors = "red" | "green" | "blue" | "purple" | "yellow";

interface WebSocketConnectResponseDto {
  round: number;
  teams: WebSocketConnectResponseDtoTeam[];
}

interface WebSocketConnectResponseDtoTeam {
  name: string;
  services: WebSocketConnectResponseDtoTeamService[];
}

interface WebSocketConnectResponseDtoTeamService {
  name: string;
  ping_status: -1 | 1;
  exploits: WebSocketConnectResponseDtoTeamServiceExploit[] | null;
}

interface WebSocketConnectResponseDtoTeamServiceExploit {
  status: 1 | -1;
}

const defaultColors = ["red", "green", "blue", "purple", "yellow"] as const;

export const colorMap: Record<TeamServiceColors, string> = {
  red: "#F37171",
  green: "#AAF371",
  blue: "#71ADF3",
  purple: "#BA71F3",
  yellow: "#F3CF71",
};

export interface Round {
  id: number;
  notifications: RoundNotification[];
}

export interface RoundNotification {
  team: string;
  service: string;
  status: boolean;
}

export function useTeams() {
  const websocket = new WebSocket("ws://defence.explabs.ru/ws");

  const teams = ref<Team[]>([]);
  const pending = ref(true);

  const rounds = ref<Round[]>([]);

  websocket.onmessage = (e) => {
    const json: unknown = JSON.parse(e.data);

    const message =
      json && typeof json === "object" && "message" in json
        ? json.message
        : null;

    if (
      message &&
      typeof message === "object" &&
      "teams" in message &&
      "round" in message
    ) {
      const response = message as WebSocketConnectResponseDto;

      if (response.round && teams.value.length === 0) {
        teams.value = response.teams.map<Team>((team) => {
          return {
            name: team.name,
            services: team.services.map<TeamService>((service, i) => {
              return {
                name: service.name,
                color: defaultColors[i],
              };
            }),
          };
        });

        pending.value = false;

        return;
      }

      if (response.round && teams.value.length > 0) {
        const roundNotifications = response.teams.reduce<RoundNotification[]>(
          (acc, team) => {
            const notifications = team.services
              .filter((item) => item.exploits && item.exploits.length > 0)
              .map<RoundNotification>((service) => ({
                service: service.name,
                status: service.ping_status === 1 ? true : false,
                team: team.name,
              }));

            acc.push(...notifications);

            return acc;
          },
          []
        );

        rounds.value.push({
          id: response.round,
          notifications: roundNotifications,
        });
      }
    }
  };

  const isLoadingTeamsCompleted = computed(() => {
    return !pending.value && teams.value.length > 0;
  });

  return { isLoadingTeamsCompleted, teams, rounds };
}
