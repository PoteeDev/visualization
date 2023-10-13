import { useAsyncData } from "#app";
import { toSvg } from "jdenticon";
import konva from "konva";
import { Ref, VNodeRef, computed, defineComponent, ref, watch } from "vue";
import {
  Round,
  RoundNotification,
  Team,
  colorMap,
  useTeams,
} from "~/composables/use-teams";
import json from "~/assets/command.json";
import styles from "./index.module.css";
import { Node } from "konva/lib/Node";
import { Animation } from "konva/lib/Animation";
import Konva from "konva";
import { GetSet } from "konva/lib/types";
import { Tween } from "konva/lib/Tween";
import { Stage } from "konva/lib/Stage";

const baseClientWidth = 1920;
const baseClientHeight = 1080;

async function importLogo() {
  return (await import("~/assets/logo.svg")).default;
}

export default defineComponent({
  setup(props, ctx) {
    const { teams, isLoadingTeamsCompleted, rounds } = useTeams();

    const { data: logoImage, pending: logoImagePending } = useAsyncData(
      "image",
      () => importLogo(),
      {
        lazy: true,
        default: () => "",
      }
    );

    const isLoadingImageCompleted = computed(() => {
      return logoImage.value.length > 0 && !logoImagePending.value;
    });

    const wrapper = ref<VNodeRef>();

    watch(
      () => wrapper.value,
      (value) => {
        initCanvas(isLoadingTeamsCompleted, logoImage, wrapper, teams, rounds);
      }
    );

    return () => (
      <div class={styles.wrapper}>
        {isLoadingImageCompleted.value && isLoadingTeamsCompleted.value ? (
          <div class={styles.content} ref={wrapper} id="wrapper"></div>
        ) : (
          <div>...loading</div>
        )}
      </div>
    );
  },
});

function initCanvas(
  isLoadingTeamsCompleted: Ref<boolean>,
  logoImage: Ref<string>,
  wrapper: Ref<VNodeRef | undefined>,
  teams: Ref<Team[]>,
  rounds: Ref<Round[]>
) {
  if (
    isLoadingTeamsCompleted.value &&
    wrapper.value instanceof HTMLDivElement
  ) {
    const canvas = document.createElement("canvas");
    const canvasCtx = canvas.getContext("2d");

    const clientWidth = wrapper.value.clientWidth;
    const clientHeight = wrapper.value.clientHeight;

    const widthNormilizedForJson = (clientWidth - baseClientWidth) / 2;
    const heightNormilizedForJson = (clientHeight - baseClientHeight) / 2;

    const stage = new konva.Stage({
      container: "wrapper",
      width: clientWidth,
      height: clientHeight,
    });

    let roundTimeout: Ref<NodeJS.Timeout | null> = ref(null);

    watch(
      () => rounds.value.length,
      () => {
        if (roundTimeout.value) {
          return;
        }

        startNotification(rounds, roundTimeout, teams, stage);
      }
    );

    watch(roundTimeout, (v) => {
      if (v === null && rounds.value.length > 0) {
        startNotification(rounds, roundTimeout, teams, stage);
      }
    });

    const radius = 500;
    const dashSize = teams.value.length;
    const angle = 360 / dashSize;

    const centerX = clientWidth / 2;
    const centerY = clientHeight / 2;

    const centerPoint = { x: centerX, y: centerY };

    const layer = new konva.Layer({});

    const commandPoints: Point[] = [];

    for (let index = 0; index < dashSize; index++) {
      const radian = ((angle * index) / 180) * Math.PI;
      const x = radius * Math.cos(radian) + centerPoint.x;
      const y = radius * Math.sin(radian) + centerPoint.y;

      commandPoints.push({ x, y });
    }

    const commandsVectors = Object.entries(json).map(([command, points]) =>
      points.map((point) => {
        return {
          x: point.x + widthNormilizedForJson,
          y: point.y + heightNormilizedForJson,
        };
      })
    );

    commandsVectors.forEach((commandVectors, i) => {
      const line = new konva.Line({
        points: commandVectors.flatMap((item) => [item.x, item.y]),
        stroke: "#2b2b2b",
        strokeWidth: 2,
        lineCap: "round",
        lineJoin: "round",
        id: "vector_" + i,
      });

      layer.add(line);
    });

    commandPoints.forEach(({ x, y }, index) => {
      const rect = new konva.Rect({
        x: x - 25,
        y: y - 25,
        width: 50,
        height: 50,
        fill: "white",
        id: "rect_" + index,
      });
      layer.add(rect);
    });

    teams.value.forEach((team, i) => {
      const svgDOM = toSvg(team.name, 500, {
        padding: 0.08,
        backColor: "#2b2b2b",
      });

      const url = "data:image/svg+xml;utf8," + encodeURIComponent(svgDOM);

      if (!canvasCtx) return;

      const gradient = canvasCtx.createLinearGradient(0, 80, 80, 0);
      gradient.addColorStop(0, "#FF35EA");
      gradient.addColorStop(1, "#1EC9FF");

      konva.Image.fromURL(url, (image) => {
        const point = commandPoints[i];

        image.x(point.x - 40);
        image.y(point.y - 40);
        image.width(80);
        image.height(80);
        image.stroke(gradient as unknown as string);
        image.cornerRadius(10);
        image.strokeWidth(6);
        image.id(team.name);

        const commandRect = new Konva.Rect({
          x: point.x - 42,
          y: point.y - 42,
          width: 84,
          height: 84,
          opacity: 0,
          strokeWidth: 6,
          cornerRadius: 10,
          id: "status_" + team.name,
        });

        layer.add(image);

        layer.add(commandRect);

        const fontSize = 20;

        const name = new konva.Text({
          text: team.name,
          fontSize,
          fill: "white",
        });

        const nameHeight = name.height();
        const nameWidth = name.width();
        const dividedHeight = nameHeight / 2;
        const normilizeTextHeight = point.y > centerY ? 65 : -65;

        name.y(point.y - dividedHeight + normilizeTextHeight);
        name.x(point.x - nameWidth / 2);

        layer.add(name);
      });
    });

    konva.Image.fromURL(logoImage.value, (image) => {
      image.x(centerPoint.x - 70);
      image.y(centerPoint.y - 70);
      image.width(140);
      image.height(140);

      layer.add(image);
    });

    stage.add(layer);
  }
}

type Point = {
  x: number;
  y: number;
};

function startNotification(
  rounds: Ref<Round[]>,
  roundTimeout: Ref<NodeJS.Timeout | null>,
  teams: Ref<Team[]>,
  stage: Stage
) {
  const nowRound = rounds.value.shift();

  if (!nowRound) {
    return;
  }

  if (!nowRound.notifications.length) {
    return;
  }

  const notificationsByTeam = nowRound.notifications.reduce<
    Record<string, RoundNotification[]>
  >((acc, item) => {
    if (!acc[item.team]) {
      acc[item.team] = [];
    }

    acc[item.team].push(item);

    return acc;
  }, {});

  roundTimeout.value = setInterval(() => {
    const nowNotificationToStart: RoundNotification[] = [];

    Object.keys(notificationsByTeam)
      .slice(0, 4)
      .forEach((item) => {
        const notifications = notificationsByTeam[item];

        const notificationToStart = notifications.pop();

        notificationToStart && nowNotificationToStart.push(notificationToStart);

        if (notifications.length === 0) {
          delete notificationsByTeam[item];
        }
      });

    if (nowNotificationToStart.length === 0) {
      roundTimeout.value && clearInterval(roundTimeout.value);
      roundTimeout.value = null;

      return;
    }

    nowNotificationToStart.forEach((notification) => {
      const teamIndex = teams.value.findIndex(
        (team) => team.name == notification.team
      );

      const team = teams.value[teamIndex] || null;

      if (!team) {
        return;
      }

      const service = team.services.find(
        (item) => item.name === notification.service
      );

      const node = stage.findOne("#vector_" + teamIndex);

      const statusNode = stage.findOne<Node & { stroke: GetSet<string, Node> }>(
        `#status_${team.name}`
      );

      if (node && service && statusNode) {
        const color = colorMap[service.color];

        let isBoxAnimationStarted = false;
        let teamBoxAnimation: Tween | null;

        const vectorAnimation = new konva.Tween({
          node,
          duration: 0.8,
          stroke: color,
          easing: Konva.Easings.EaseOut,
          onUpdate() {
            if (!isBoxAnimationStarted) {
              isBoxAnimationStarted = true;

              statusNode.stroke(notification.status ? "#51A544" : "#DF4949");

              teamBoxAnimation = new konva.Tween({
                node: statusNode,
                duration: 0.8,
                opacity: 1,
                easing: Konva.Easings.EaseOut,
                onFinish() {
                  teamBoxAnimation?.reverse();
                },
              });

              teamBoxAnimation.play();
            }
          },
          onFinish() {
            vectorAnimation.reverse();
          },
        });
        vectorAnimation.play();
      }
    });
  }, 2500);
}

function lerp(a: number, b: number, u: number) {
  return (1 - u) * a + u * b;
}

type RGB = { red: number; green: number; blue: number };

function color(
  element: Node,
  start: RGB,
  end: RGB,
  duration: number,
  a: Animation
) {
  const interval = 10;
  const steps = duration / interval;
  const step_u = 1.0 / steps;
  let u = 0.0;
  const timeout = setInterval(function () {
    if (u >= 1.0) {
      clearInterval(timeout);
      a.stop();
    }
    const r = Math.round(lerp(start.red, end.red, u));
    const g = Math.round(lerp(start.green, end.green, u));
    const b = Math.round(lerp(start.blue, end.blue, u));

    const tween = new konva.Tween({
      node: element,
      duration: 1,
      stroke: rgbToHex(r, g, b),
    });

    tween.play();

    u += step_u;
  }, interval);
}

function componentToHex(c: number) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
