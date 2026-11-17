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
bool HasText(lv_obj_t* obj, const char* text) {
    if (lv_obj_check_type(obj, &lv_label_class) && std::strcmp(lv_label_get_text(obj), text)==0) return true;
    for (uint32_t i=0;i<lv_obj_get_child_count(obj);++i) if (HasText(lv_obj_get_child(obj,i),text)) return true;
    return false;
}
void AssertPage(lv_obj_t* root, const char* title, const char* from, const char* to) {
    assert(HasText(lv_obj_get_child(root,1),title));
    auto body=lv_obj_get_child(root,3);
    assert(HasText(body,from));assert(HasText(body,to));
}
static lv_point_t touch;
static lv_indev_state_t touch_state=LV_INDEV_STATE_RELEASED;
void Drag(lv_indev_t* pointer, int x) {
    for (int y=160;y>=90;y-=10) {
        touch={x,y};touch_state=LV_INDEV_STATE_PRESSED;
        lv_tick_inc(20);lv_indev_read(pointer);
    }
    touch_state=LV_INDEV_STATE_RELEASED;lv_tick_inc(20);lv_indev_read(pointer);
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
    AssertPage(root,"経路概要","光が丘","池袋");
    // Header has three clips, then body and footer buttons.
    lv_obj_send_event(lv_obj_get_child(root,4),LV_EVENT_CLICKED,nullptr);
    AssertPage(root,"区間 1/2","光が丘","練馬");
    assert(!HasText(lv_obj_get_child(root,3),"池袋"));
    Snapshot("leg1.ppm");
    lv_obj_send_event(lv_obj_get_child(root,5),LV_EVENT_CLICKED,nullptr);
    AssertPage(root,"区間 2/2","練馬","池袋");
    assert(!HasText(lv_obj_get_child(root,3),"光が丘"));
    Snapshot("leg2.ppm");
    lv_obj_send_event(lv_obj_get_child(root,4),LV_EVENT_CLICKED,nullptr);
    AssertPage(root,"区間 1/2","光が丘","練馬");
    lv_obj_send_event(lv_obj_get_child(root,4),LV_EVENT_CLICKED,nullptr);
    AssertPage(root,"経路概要","光が丘","池袋");
    lv_obj_send_event(lv_obj_get_child(root,6),LV_EVENT_CLICKED,nullptr);
    assert(lv_obj_has_flag(root,LV_OBJ_FLAG_HIDDEN));
    view.Show(route,font);assert(!lv_obj_has_flag(root,LV_OBJ_FLAG_HIDDEN));
    route.legs.resize(30,route.legs[0]);view.Show(route,font);lv_obj_update_layout(root);
    assert(lv_obj_get_scroll_bottom(lv_obj_get_child(root,3))>0);
    auto pointer=lv_indev_create();
    lv_indev_set_type(pointer,LV_INDEV_TYPE_POINTER);
    lv_indev_set_display(pointer,display);
    lv_indev_set_read_cb(pointer,[](lv_indev_t*,lv_indev_data_t* data) {
        data->point=touch;data->state=touch_state;
    });
    // Hit testing must reach the scrolling body through both rail and empty margin.
    for (int x : {28,300}) {
        view.Show(route,font);lv_obj_update_layout(root);
        auto body=lv_obj_get_child(root,3);
        assert(lv_obj_get_scroll_y(body)==0);
        Drag(pointer,x);
        assert(lv_obj_get_scroll_y(body)>0);
    }
    lv_indev_delete(pointer);
    view.SetFont(font);view.Hide();
    }
    lv_tiny_ttf_destroy(font);
    lv_display_delete(display);
    lv_deinit();
}
