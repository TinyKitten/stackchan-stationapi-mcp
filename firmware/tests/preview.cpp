#include "route_view.h"
#include <fstream>
#include <iterator>
#include <cassert>
static uint32_t screen[320*240];
static void Flush(lv_display_t* display, const lv_area_t* area, uint8_t* data) {
    auto pixels = reinterpret_cast<uint32_t*>(data);
    for (int y=area->y1;y<=area->y2;++y) for (int x=area->x1;x<=area->x2;++x) screen[y*320+x]=*pixels++;
    lv_display_flush_ready(display);
}
void Snapshot(const char* name) {
    lv_obj_update_layout(lv_layer_top()); lv_refr_now(nullptr);
    std::ofstream out(name,std::ios::binary); out<<"P6\n320 240\n255\n";
    for(auto pixel:screen) { out.put((pixel>>16)&255);out.put((pixel>>8)&255);out.put(pixel&255); }
}
int main(int argc, char** argv) {
    assert(argc == 2);
    lv_init();
    auto display=lv_display_create(320,240);
    static uint32_t buffer[320*240];
    lv_display_set_buffers(display,buffer,nullptr,sizeof(buffer),LV_DISPLAY_RENDER_MODE_FULL);
    lv_display_set_flush_cb(display,Flush);
    std::ifstream f(argv[1],std::ios::binary);
    std::vector<char> bytes((std::istreambuf_iterator<char>(f)),{});
    auto font=lv_tiny_ttf_create_data(bytes.data(),bytes.size(),20);assert(font);
    route_ui::Route route;route.minutes=25;
    route.legs={{"光が丘","練馬","大江戸線","各停",0xE85A9B},{"練馬","池袋","西武池袋線","各停",0xF2B344}};
    {
    route_ui::View view;view.Show(route,font);Snapshot("overview.ppm");
    auto root=lv_obj_get_child(lv_layer_top(),-1);
    // Header has three clips, then body and footer buttons.
    lv_obj_send_event(lv_obj_get_child(root,4),LV_EVENT_CLICKED,nullptr);
    Snapshot("leg1.ppm");
    lv_obj_send_event(lv_obj_get_child(root,5),LV_EVENT_CLICKED,nullptr);
    Snapshot("leg2.ppm");
    lv_obj_send_event(lv_obj_get_child(root,6),LV_EVENT_CLICKED,nullptr);
    assert(lv_obj_has_flag(root,LV_OBJ_FLAG_HIDDEN));
    view.Show(route,font);assert(!lv_obj_has_flag(root,LV_OBJ_FLAG_HIDDEN));
    route.legs.resize(30,route.legs[0]);view.Show(route,font);lv_obj_update_layout(root);
    assert(lv_obj_get_scroll_bottom(lv_obj_get_child(root,3))>0);
    view.SetFont(font);view.Hide();
    }
    lv_tiny_ttf_destroy(font);
    lv_display_delete(display);
    lv_deinit();
}
