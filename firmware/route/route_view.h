#pragma once
#include "route_model.h"
#include <lvgl.h>

namespace route_ui {
// Geometry and colors from Figma 8:10 / 8:41 / 8:71 (320 x 240).
// Text uses the installed Japanese font, scaled to the design's line heights.
class View {
    lv_obj_t* root_ = nullptr;
    const lv_font_t* font_ = nullptr;
    Route route_;
    int page_ = 0;
    static lv_obj_t* Box(lv_obj_t* parent, int x, int y, int w, int h, uint32_t color, int radius = 0) {
        auto obj = lv_obj_create(parent);
        lv_obj_remove_style_all(obj);
        lv_obj_set_pos(obj, x, y); lv_obj_set_size(obj, w, h);
        lv_obj_set_style_bg_color(obj, lv_color_hex(color), 0);
        lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(obj, radius, 0);
        lv_obj_remove_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_remove_flag(obj, LV_OBJ_FLAG_CLICKABLE);
        return obj;
    }
    void Text(lv_obj_t* parent, int x, int y, int w, int h, const std::string& text,
              uint32_t color = 0xFFFFFF, bool centered = false) {
        // Clip each independently scrolling line; transformed labels do not change layout.
        auto clip = Box(parent, x, y, w, h, 0);
        lv_obj_set_style_bg_opa(clip, LV_OPA_TRANSP, 0);
        lv_font_glyph_dsc_t glyph{};
        lv_font_get_glyph_dsc(font_, &glyph, 0x56FD, 0); // 国: measure the installed CJK glyph.
        const int size = (h == 22 || h == 14 || h == 15) ? h - 2 : h - 4;
        const int glyph_height = glyph.box_h ? glyph.box_h : font_->line_height;
        const int scale = size * 256 / glyph_height;
        const int top = font_->line_height - font_->base_line - glyph.box_h - glyph.ofs_y;
        const bool bold = h == 28 || h == 22 || h == 21 || h == 20 || h == 15;
        // A one-pixel overprint provides emphasis with the installed regular bitmap font.
        for (int stroke = 0; stroke < (bold ? 2 : 1); ++stroke) {
            auto label = lv_label_create(clip);
            lv_obj_remove_style_all(label);
            lv_obj_set_pos(label, stroke, (h - size) / 2 - top * scale / 256);
            lv_obj_set_style_text_font(label, font_, 0);
            lv_obj_set_style_text_color(label, lv_color_hex(color), 0);
            lv_obj_set_style_text_opa(label, LV_OPA_COVER, 0);
            if (centered) lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
            lv_obj_set_width(label, (w - 1) * 256 / scale);
            lv_label_set_long_mode(label, LV_LABEL_LONG_SCROLL_CIRCULAR);
            lv_label_set_text(label, text.c_str());
            lv_obj_set_style_transform_pivot_x(label, 0, 0);
            lv_obj_set_style_transform_pivot_y(label, 0, 0);
            lv_obj_set_style_transform_scale_x(label, scale, 0);
            lv_obj_set_style_transform_scale_y(label, scale, 0);
        }
    }
    static uint32_t Light(uint32_t c) {
        // Keep even black/dark API colors legible against the dark panel.
        return ((((c >> 16) + 255) / 2) << 16) | (((((c >> 8) & 255) + 255) / 2) << 8) | (((c & 255) + 255) / 2);
    }
    void Marker(lv_obj_t* body, int y, uint32_t color) {
        auto circle = Box(body, 12, y, 12, 12, 0xFFFFFF, LV_RADIUS_CIRCLE);
        lv_obj_set_style_border_width(circle, 3, 0);
        lv_obj_set_style_border_color(circle, lv_color_hex(color), 0);
    }
    void Button(int x, int w, const std::string& text, int action, bool primary = false) {
        auto button = Box(root_, x, 188, w, 40, primary ? 0xFFFFFF : 0x26323C, 8);
        lv_obj_add_flag(button, LV_OBJ_FLAG_CLICKABLE);
        Text(button, 4, 10, w - 8, 20, text, primary ? 0x071018 : 0xFFFFFF, true);
        // Child text objects must not intercept taps intended for the button.
        lv_obj_remove_flag(lv_obj_get_child(button, 0), LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_user_data(button, reinterpret_cast<void*>(static_cast<intptr_t>(action)));
        lv_obj_add_event_cb(button, [](lv_event_t* event) {
            auto self = static_cast<View*>(lv_event_get_user_data(event));
            auto target = static_cast<lv_obj_t*>(lv_event_get_current_target(event));
            const int action = static_cast<int>(reinterpret_cast<intptr_t>(lv_obj_get_user_data(target)));
            if (action == -1) { self->Hide(); return; }
            // LVGL tracks deletion of the current event target during refresh.
            self->page_ = action;
            lv_obj_send_event(self->root_, LV_EVENT_REFRESH, nullptr);
        }, LV_EVENT_CLICKED, this);
    }
    void Render() {
        lv_obj_clean(root_);
        Text(root_, 10, 10, 206, 28, route_.legs.back().to);
        Text(root_, 224, 10, 86, 18, page_ == 0 ? "経路概要" : "区間 " + std::to_string(page_) + "/" + std::to_string(route_.legs.size()), 0xB9CCD7);
        auto summary = route_.minutes < 0 ? std::string("所要時間不明") : "約" + std::to_string(route_.minutes) + "分（推定）";
        Text(root_, 10, 40, 300, 19, summary + " · 乗換" + std::to_string(route_.legs.size() - 1) + "回", 0xDFE9EE);
        auto body = Box(root_, 10, 68, 300, 110, 0x12202A, 8);
        if (page_ == 0) {
            lv_obj_add_flag(body, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_add_flag(body, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_set_scroll_dir(body, LV_DIR_VER);
            int y = 5;
            for (size_t i = 0; i < route_.legs.size(); ++i) {
                const auto& leg = route_.legs[i];
                // Preserve disconnected endpoints (e.g. a walking transfer).
                if (i && route_.legs[i-1].to != leg.from) {
                    Text(body, 36, y, 254, 22, route_.legs[i-1].to); y += 26;
                }
                Box(body, 16, y + 10, 4, 40, leg.color);
                Marker(body, y + 4, leg.color);
                Text(body, 36, y, i ? 144 : 254, 22, leg.from);
                if (i) Text(body, 198, y + 2, 80, 15, "乗換", 0xF5CB7D);
                Text(body, 36, y + 22, 254, 14, leg.line, Light(leg.color));
                y += 40;
            }
            Marker(body, y + 4, route_.legs.back().color);
            Text(body, 36, y, 254, 22, route_.legs.back().to);
            Button(10, 110, "区間を見る", 1, true);
            // Counter is informational, not a dead button.
            auto counter = Box(root_, 128, 188, 94, 40, 0x26323C, 8);
            Text(counter, 12, 10, 70, 20, "1 / " + std::to_string(route_.legs.size() + 1), 0xFFFFFF, true);
        } else {
            const auto& leg = route_.legs[page_ - 1];
            Box(body, 16, 15, 4, 80, leg.color);
            Marker(body, 9, leg.color); Marker(body, 89, leg.color);
            Text(body, 36, 5, 254, 28, leg.from);
            Text(body, 36, 33, 254, 21, leg.line, Light(leg.color));
            Text(body, 36, 55, 254, 17, leg.type, 0xDFE9EE);
            Text(body, 36, 77, 156, 28, leg.to);
            Text(body, 200, 77, 90, 17, page_ == static_cast<int>(route_.legs.size()) ? "目的地" : "ここで乗換");
            Button(10, 110, page_ == 1 ? "概要" : "前の区間", Previous(page_));
            Button(128, 94, page_ == static_cast<int>(route_.legs.size()) ? "概要" : "次の区間", Next(page_, route_.legs.size()));
        }
        Button(230, 80, "閉じる", -1);
    }
public:
    // All methods are called with the display lock held, including LVGL events.
    ~View() { if (root_) lv_obj_delete(root_); }
    void Show(Route route, const lv_font_t* font) {
        route_ = std::move(route); font_ = font; page_ = 0;
        if (!root_) {
            root_ = Box(lv_layer_top(), 0, 0, 320, 240, 0x071018);
            lv_obj_add_flag(root_, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_event_cb(root_, [](lv_event_t* event) {
                static_cast<View*>(lv_event_get_user_data(event))->Render();
            }, LV_EVENT_REFRESH, this);
        }
        lv_obj_remove_flag(root_, LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(root_);
        Render();
    }
    void Hide() { if (root_) lv_obj_add_flag(root_, LV_OBJ_FLAG_HIDDEN); }
    void SetFont(const lv_font_t* font) { font_ = font; if (root_) Render(); }
};
}
