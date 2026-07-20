<!-- @workspace shared -->
<script setup lang="ts">
// Decorative background — purely visual, no props or logic needed
</script>

<template>
  <div
    class="decorative-bg"
    aria-hidden="true"
  >
    <!-- 大圆 - 缓慢旋转 -->
    <div class="shape shape--circle-large" />

    <!-- 中圆 - 上下浮动 -->
    <div class="shape shape--circle-medium" />

    <!-- 小圆 - 对角线漂移 -->
    <div class="shape shape--circle-small" />

    <!-- 装饰斜线 1 -->
    <div class="shape shape--line-1" />

    <!-- 装饰斜线 2 -->
    <div class="shape shape--line-2" />
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

.decorative-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.shape {
  position: absolute;
  border-radius: 9999px;
  will-change: transform;
}

/* ---- Circles ---- */

.shape--circle-large {
  width: 650px;
  height: 650px;
  top: -200px;
  right: -120px;
  background: radial-gradient(circle, hsl(var(--primary) / 0.06), transparent 70%);
  animation: rotate-slow 30s linear infinite;
}

.shape--circle-medium {
  width: 360px;
  height: 360px;
  bottom: 8%;
  left: -100px;
  background: radial-gradient(circle, hsl(var(--primary) / 0.05), transparent 70%);
  animation: float 20s ease-in-out infinite;
}

.shape--circle-small {
  width: 180px;
  height: 180px;
  top: 35%;
  left: 65%;
  background: radial-gradient(circle, hsl(var(--primary) / 0.04), transparent 70%);
  animation: diagonal 25s ease-in-out infinite;
}

/* ---- Lines ---- */

.shape--line-1 {
  width: 1px;
  height: 100vh;
  top: 0;
  left: 18%;
  border-radius: 0;
  background: linear-gradient(
    to bottom,
    transparent,
    hsl(var(--primary) / 0.04) 30%,
    hsl(var(--primary) / 0.04) 70%,
    transparent
  );
  animation: sway-1 22s ease-in-out infinite;
}

.shape--line-2 {
  width: 1px;
  height: 80vh;
  top: 10%;
  right: 25%;
  border-radius: 0;
  background: linear-gradient(to bottom, hsl(var(--primary) / 0.03) 20%, transparent 80%);
  animation: sway-2 28s ease-in-out infinite;
}

/* ---- Keyframes ---- */

@keyframes rotate-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-40px);
  }
}

@keyframes diagonal {
  0%,
  100% {
    transform: translate(0, 0);
  }
  33% {
    transform: translate(40px, -25px);
  }
  66% {
    transform: translate(20px, 25px);
  }
}

@keyframes sway-1 {
  0%,
  100% {
    transform: rotate(12deg) translateY(0);
  }
  50% {
    transform: rotate(18deg) translateY(15px);
  }
}

@keyframes sway-2 {
  0%,
  100% {
    transform: rotate(-22deg) translateY(0);
  }
  50% {
    transform: rotate(-16deg) translateY(-20px);
  }
}

/* ---- Reduced motion ---- */

@media (prefers-reduced-motion: reduce) {
  .shape {
    animation: none !important;
    transform: none;
  }
}
</style>
